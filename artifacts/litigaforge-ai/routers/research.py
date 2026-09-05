"""
LitigaForge AI — Student Research Portfolio Router

Logged-in users bookmark judgments with personal notes and get a public,
shareable research profile at /profile/{username}/research. Usernames are
unique (validated format, reserved words blocked). Profiles can be public
or hidden (visibility flag only — no social/follow features).
"""
import re

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import require_user
from database import execute as db_execute, fetch as db_fetch, fetchrow as db_fetchrow
from rate_limit import limiter
from sanitizer import sanitize_text
from logger import get_logger
from routers.judgments import _serialize

logger = get_logger("litigaforge.research")

router = APIRouter(tags=["research"])

NOTES_MAX = 2000

# Usernames: start with a letter, 3–30 chars, lowercase letters/digits/underscore.
_USERNAME_RE = re.compile(r"^[a-z][a-z0-9_]{2,29}$")

# Reserved words — route names, system identifiers, and common impersonation
# targets. Blocked case-insensitively so a profile slug never shadows a real
# page or implies an official account.
_RESERVED_USERNAMES = {
    "admin", "administrator", "root", "superuser", "support", "help", "system",
    "api", "auth", "login", "logout", "register", "signup", "signin", "account",
    "settings", "profile", "research", "user", "users", "me", "you",
    "litigaforge", "official", "staff", "team", "moderator", "mod",
    "about", "contact", "privacy", "terms", "refund", "refund-policy", "legal",
    "judgments", "judgment", "lawyers", "lawyer", "ask", "review", "legal-aid",
    "subscription", "subscribe", "digest", "blog", "faq", "documents",
    "post-case", "my-cases", "matches", "legal-chat", "dashboard",
    "www", "mail", "email", "ftp", "static", "assets", "public", "null",
    "undefined", "anonymous", "guest", "test", "demo",
}


# ── request models ──────────────────────────────────────────────────────────

class UsernameRequest(BaseModel):
    username: str


class VisibilityRequest(BaseModel):
    is_public: bool


class BookmarkRequest(BaseModel):
    judgment_id: int
    notes: str | None = None


class NotesRequest(BaseModel):
    notes: str | None = None


# ── helpers ─────────────────────────────────────────────────────────────────

def _validate_username(raw: str) -> str:
    """Normalise and validate a requested username. Raises HTTPException(422)."""
    if not isinstance(raw, str):
        raise HTTPException(422, "Username must be text")
    name = raw.strip().lower()
    if not name:
        raise HTTPException(422, "Username is required")
    if not _USERNAME_RE.match(name):
        raise HTTPException(
            422,
            "Username must be 3–30 characters, start with a letter, and use only "
            "lowercase letters, numbers, and underscores.",
        )
    if name in _RESERVED_USERNAMES:
        raise HTTPException(409, "That username is reserved. Please choose another.")
    return name


def _clean_notes(raw: str | None) -> str:
    if not raw:
        return ""
    try:
        return sanitize_text(raw, max_length=NOTES_MAX, field_name="notes")
    except ValueError as e:
        raise HTTPException(422, str(e))


def _bookmark_item(row: dict) -> dict:
    """Split a joined bookmark+judgment row into {judgment, notes, saved_at}."""
    d = dict(row)
    notes = d.pop("bookmark_notes", "") or ""
    saved_at = d.pop("saved_at", None)
    judgment = _serialize(d)
    return {
        "judgment": judgment,
        "notes": notes,
        "saved_at": str(saved_at) if saved_at else None,
    }


_JUDGMENT_COLS = (
    "j.id, j.case_name, j.court, j.court_slug, j.bench, j.judgment_date, "
    "j.year, j.slug, j.outcome, j.citation, j.summary_en, j.og_image_url, "
    "j.created_at, j.updated_at"
)


# ── username + visibility ───────────────────────────────────────────────────

@router.post("/research/username")
@limiter.limit("10/minute")
async def set_username(
    body: UsernameRequest,
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Claim or change the user's public username (case-insensitive unique)."""
    name = _validate_username(body.username)
    try:
        row = await db_fetchrow(
            "UPDATE users SET username = $1 WHERE id = $2 "
            "RETURNING username, COALESCE(is_profile_public, TRUE) AS is_profile_public",
            name, current_user["id"],
        )
    except asyncpg.exceptions.UniqueViolationError:
        raise HTTPException(409, "That username is already taken. Please choose another.")
    if not row:
        raise HTTPException(404, "User not found")
    logger.info("Username set: user_id=%s username=%s", current_user["id"], name)
    return {"username": row["username"], "is_profile_public": row["is_profile_public"]}


@router.put("/research/visibility")
@router.patch("/research/visibility", include_in_schema=False)
@limiter.limit("20/minute")
async def set_visibility(
    body: VisibilityRequest,
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Toggle whether the user's research profile is publicly visible."""
    row = await db_fetchrow(
        "UPDATE users SET is_profile_public = $1 WHERE id = $2 "
        "RETURNING COALESCE(is_profile_public, TRUE) AS is_profile_public",
        body.is_public, current_user["id"],
    )
    if not row:
        raise HTTPException(404, "User not found")
    return {"is_profile_public": row["is_profile_public"]}


# ── bookmarks (authenticated) ───────────────────────────────────────────────

@router.get("/research/me")
@limiter.limit("60/minute")
async def my_research(
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Current user's own portfolio: username, visibility, count, bookmarks."""
    rows = await db_fetch(
        f"""SELECT {_JUDGMENT_COLS},
                   b.notes AS bookmark_notes, b.created_at AS saved_at
            FROM judgment_bookmarks b
            JOIN judgments j ON j.id = b.judgment_id
            WHERE b.user_id = $1
            ORDER BY b.created_at DESC""",
        current_user["id"],
    )
    return {
        "username": current_user.get("username"),
        "is_profile_public": current_user.get("is_profile_public", True),
        "name": current_user.get("name"),
        "count": len(rows),
        "bookmarks": [_bookmark_item(r) for r in rows],
    }


@router.get("/research/bookmarks/{judgment_id}")
@limiter.limit("120/minute")
async def bookmark_status(
    judgment_id: int,
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Whether the current user has bookmarked this judgment (+ its notes)."""
    row = await db_fetchrow(
        "SELECT notes FROM judgment_bookmarks WHERE user_id = $1 AND judgment_id = $2",
        current_user["id"], judgment_id,
    )
    if not row:
        return {"bookmarked": False, "notes": ""}
    return {"bookmarked": True, "notes": row["notes"] or ""}


@router.post("/research/bookmarks")
@limiter.limit("60/minute")
async def add_bookmark(
    body: BookmarkRequest,
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Save a judgment to the user's research portfolio (upsert with notes)."""
    judgment = await db_fetchrow(
        "SELECT id FROM judgments WHERE id = $1 AND status = 'published'",
        body.judgment_id,
    )
    if not judgment:
        raise HTTPException(404, "Judgment not found")
    notes = _clean_notes(body.notes)
    row = await db_fetchrow(
        """INSERT INTO judgment_bookmarks (user_id, judgment_id, notes)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, judgment_id)
           DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW()
           RETURNING id, notes""",
        current_user["id"], body.judgment_id, notes,
    )
    logger.info(
        "Bookmark saved: user_id=%s judgment_id=%s", current_user["id"], body.judgment_id
    )
    return {"bookmarked": True, "id": row["id"], "notes": row["notes"] or ""}


@router.patch("/research/bookmarks/{judgment_id}")
@limiter.limit("60/minute")
async def update_bookmark_notes(
    judgment_id: int,
    body: NotesRequest,
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Edit the personal notes on an existing bookmark."""
    notes = _clean_notes(body.notes)
    row = await db_fetchrow(
        "UPDATE judgment_bookmarks SET notes = $1, updated_at = NOW() "
        "WHERE user_id = $2 AND judgment_id = $3 RETURNING id, notes",
        notes, current_user["id"], judgment_id,
    )
    if not row:
        raise HTTPException(404, "Bookmark not found")
    return {"bookmarked": True, "notes": row["notes"] or ""}


@router.delete("/research/bookmarks/{judgment_id}")
@limiter.limit("60/minute")
async def delete_bookmark(
    judgment_id: int,
    request: Request,
    current_user: dict = Depends(require_user),
):
    """Remove a judgment from the user's research portfolio."""
    result = await db_execute(
        "DELETE FROM judgment_bookmarks WHERE user_id = $1 AND judgment_id = $2",
        current_user["id"], judgment_id,
    )
    if result.endswith("0"):
        raise HTTPException(404, "Bookmark not found")
    return {"bookmarked": False}


# ── public profile ──────────────────────────────────────────────────────────

@router.get("/research/profile/{username}")
@limiter.limit("60/minute")
async def public_profile(username: str, request: Request):
    """Public research portfolio for a username. 404 if not found or hidden."""
    uname = (username or "").strip().lower()
    if not uname:
        raise HTTPException(404, "Profile not found")
    user = await db_fetchrow(
        "SELECT id, name, username, COALESCE(is_profile_public, TRUE) AS is_profile_public "
        "FROM users WHERE lower(username) = $1",
        uname,
    )
    if not user or not user["is_profile_public"]:
        # Same response for hidden and missing — don't leak existence.
        raise HTTPException(404, "Profile not found")
    rows = await db_fetch(
        f"""SELECT {_JUDGMENT_COLS},
                   b.notes AS bookmark_notes, b.created_at AS saved_at
            FROM judgment_bookmarks b
            JOIN judgments j ON j.id = b.judgment_id
            WHERE b.user_id = $1 AND j.status = 'published'
            ORDER BY b.created_at DESC""",
        user["id"],
    )
    return {
        "username": user["username"],
        "name": user["name"],
        "count": len(rows),
        "bookmarks": [_bookmark_item(r) for r in rows],
    }
