"""
LitigaForge AI — Judgment Digest Router (Phase 1)

Public read endpoints for the Daily Supreme Court & High Court Judgment Digest,
plus a dynamic OG share-card image and sitemap feed. Backed by the `judgments`
table (seeded with real landmark sample cases in main.py). No scraping here —
ingestion is a later phase.
"""
import io
import logging
import os
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response

from database import fetch, fetchrow, fetchval
from rate_limit import limiter
from citation_extractor import extract_citations_sync, extract_citations

logger = logging.getLogger("litigaforge.judgments")
router = APIRouter(tags=["judgments"])

BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")
SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com").rstrip("/")

_FONT_DIR = "/usr/share/fonts/truetype/dejavu"


# ── helpers ──────────────────────────────────────────────────────────────────

def _og_url(court_slug: str, year, slug: str) -> str:
    return f"{SITE_URL}{BASE_PATH}/judgments/og/{court_slug}/{year}/{slug}.png"


def _page_path(court_slug: str, year, slug: str) -> str:
    return f"/judgments/{court_slug}/{year}/{slug}"


def _serialize(row: dict) -> dict:
    d = dict(row)
    jd = d.get("judgment_date")
    d["judgment_date"] = jd.isoformat() if jd else None
    for k in ("created_at", "updated_at"):
        if d.get(k) is not None:
            d[k] = str(d[k])
    if "acts_cited" in d:
        d["acts_cited"] = list(d.get("acts_cited") or [])
    # entities is a JSONB field populated by legal_nlp.extract_entities();
    # omit the key entirely on list responses (SELECT doesn't include it),
    # and normalise to None when the column is present but NULL.
    if "entities" in d:
        raw_ent = d.get("entities")
        d["entities"] = raw_ent if isinstance(raw_ent, dict) else None
    # citations_count: regex-only, sync, cheap — suitable for list responses.
    # The full citations_found list (with internal_path) is only added by
    # the detail endpoint via extract_citations() (async + DB lookup).
    d["citations_count"] = len(extract_citations_sync(d.get("summary_en") or ""))
    d["og_image_url"] = d.get("og_image_url") or _og_url(
        d["court_slug"], d["year"], d["slug"]
    )
    d["path"] = _page_path(d["court_slug"], d["year"], d["slug"])
    d["url"] = f"{SITE_URL}{d['path']}"
    return d


# ── tolerant canonical resolution ─────────────────────────────────────────────
# Existing judgment slugs are NEVER renamed. Instead, truncated / wrong-court /
# stray-keyword URLs are resolved to their canonical form so old, shared or
# typo'd links keep working (the api-server then issues a real 301).

_SLUG_SEP_RE = re.compile(r"[^a-z0-9]+")
_SLUG_V_RE = re.compile(r"-(?:vs|versus|v)-")


def _norm_slug(s: str) -> str:
    """Normalise a slug for tolerant matching: lowercase, collapse non-alnum to
    '-', and fold the version separator (vs / versus / v) to a single 'v'."""
    s = _SLUG_SEP_RE.sub("-", (s or "").lower()).strip("-")
    s = _SLUG_V_RE.sub("-v-", s)
    return s


async def _resolve_canonical(court_slug: str, year: int, slug: str) -> Optional[dict]:
    """Resolve a (possibly wrong / truncated) judgment URL to its canonical row.

    Returns ``{court_slug, year, slug, exact}`` for a confident match, else
    ``None``. A non-exact match is only offered when EXACTLY ONE published
    judgment matches, so we never guess between two cases. The court_slug is
    intentionally ignored on the tolerant pass (e.g. ``supreme-court`` vs the
    canonical ``supreme-court-of-india``); year is preferred but not required.
    """
    exact = await fetchrow(
        """SELECT court_slug, year, slug FROM judgments
           WHERE court_slug = $1 AND year = $2 AND slug = $3 AND status = 'published'""",
        court_slug, year, slug,
    )
    if exact:
        return {"court_slug": exact["court_slug"], "year": exact["year"],
                "slug": exact["slug"], "exact": True}

    req = _norm_slug(slug)
    if not req:
        return None
    rows = await fetch(
        "SELECT court_slug, year, slug FROM judgments WHERE status = 'published'"
    )

    def _matches(cand_slug: str) -> bool:
        c = _norm_slug(cand_slug)
        return c == req or c.startswith(req + "-") or req.startswith(c + "-")

    same_year = [r for r in rows if r["year"] == year and _matches(r["slug"])]
    cands = same_year or [r for r in rows if _matches(r["slug"])]
    uniq = {(r["court_slug"], r["year"], r["slug"]) for r in cands}
    if len(uniq) != 1:
        return None
    r = cands[0]
    return {"court_slug": r["court_slug"], "year": r["year"],
            "slug": r["slug"], "exact": False}


# ── list ─────────────────────────────────────────────────────────────────────

@router.get("/judgments")
@limiter.limit("120/minute")
async def list_judgments(
    request: Request,
    court: Optional[str] = Query(None, description="Filter by court_slug"),
    year: Optional[int] = Query(None, description="Filter by year"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    where = ["status = 'published'"]
    args: list = []
    if court:
        args.append(court)
        where.append(f"court_slug = ${len(args)}")
    if year:
        args.append(year)
        where.append(f"year = ${len(args)}")
    where_sql = " AND ".join(where)

    total = await fetchval(f"SELECT COUNT(*) FROM judgments WHERE {where_sql}", *args)
    rows = await fetch(
        f"""SELECT id, case_name, court, court_slug, bench, judgment_date, year, slug,
                   summary_en, summary_hi, acts_cited, outcome, citation,
                   source_name, source_url, og_image_url, created_at
            FROM judgments
            WHERE {where_sql}
            ORDER BY judgment_date DESC NULLS LAST, id DESC
            LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}""",
        *args, limit, offset,
    )
    courts = await fetch(
        """SELECT court_slug, court, COUNT(*) AS count
           FROM judgments WHERE status = 'published'
           GROUP BY court_slug, court ORDER BY court"""
    )
    return {
        "total": int(total or 0),
        "limit": limit,
        "offset": offset,
        "judgments": [_serialize(r) for r in rows],
        "courts": [dict(c) for c in courts],
    }


# ── sitemap feed (crawled by the api-server) ──────────────────────────────────

@router.get("/judgments/sitemap-data")
async def judgments_sitemap_data():
    rows = await fetch(
        """SELECT court_slug, year, slug, COALESCE(updated_at, created_at) AS lastmod
           FROM judgments WHERE status = 'published'
           ORDER BY judgment_date DESC NULLS LAST"""
    )
    items = []
    for r in rows:
        lm = r.get("lastmod")
        lastmod = None
        if lm is not None:
            lastmod = lm.date().isoformat() if hasattr(lm, "date") else str(lm)[:10]
        path = _page_path(r["court_slug"], r["year"], r["slug"])
        items.append({"path": path, "url": f"{SITE_URL}{path}", "lastmod": lastmod})
    return {"items": items}


# ── single judgment ───────────────────────────────────────────────────────────

@router.get("/judgments/item/{court_slug}/{year}/{slug}")
@limiter.limit("120/minute")
async def get_judgment(request: Request, court_slug: str, year: int, slug: str):
    row = await fetchrow(
        """SELECT * FROM judgments
           WHERE court_slug = $1 AND year = $2 AND slug = $3 AND status = 'published'""",
        court_slug, year, slug,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Judgment not found")
    data = _serialize(row)
    # Enrich detail with full citation list: regex + DB lookup for internal_path.
    # Runs over both the summary and the first 4 kB of full_text.
    try:
        data["citations_found"] = await extract_citations(
            data.get("summary_en") or "",
            (row.get("full_text") or "")[:4000],
        )
    except Exception as _ce:
        logger.warning("citations: enrichment failed for %s/%s/%s: %s", court_slug, year, slug, _ce)
        data["citations_found"] = extract_citations_sync(data.get("summary_en") or "")
    related = await fetch(
        """SELECT case_name, court, court_slug, year, slug, outcome, judgment_date
           FROM judgments
           WHERE status = 'published' AND id <> $1
           ORDER BY (court_slug = $2) DESC, judgment_date DESC NULLS LAST
           LIMIT 4""",
        row["id"], court_slug,
    )
    data["related"] = [_serialize(r) for r in related]
    return data


@router.get("/judgments/resolve/{court_slug}/{year}/{slug}")
@limiter.limit("240/minute")
async def resolve_judgment(request: Request, court_slug: str, year: int, slug: str):
    """Lightweight canonical resolver powering tolerant judgment URLs. The
    api-server calls this to issue a real 301 (and the SPA uses it as a
    client-side net) so truncated / wrong-court / stray-keyword links forward to
    the canonical URL. 404 when no confident match exists."""
    res = await _resolve_canonical(court_slug, year, slug)
    if not res:
        raise HTTPException(status_code=404, detail="Judgment not found")
    res["path"] = _page_path(res["court_slug"], res["year"], res["slug"])
    return res


# ── OG share-card image (Pillow) ──────────────────────────────────────────────

def _wrap(text: str, font, max_width: int, max_lines: int) -> list:
    words = (text or "").split()
    lines: list = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if font.getlength(trial) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
            if len(lines) >= max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
    return lines


def _render_og(row: dict) -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    W, H = 1200, 630
    navy = (26, 39, 68)
    amber = (245, 158, 11)
    white = (255, 255, 255)
    muted = (203, 213, 225)
    margin = 80

    img = Image.new("RGB", (W, H), navy)
    d = ImageDraw.Draw(img)

    f_brand = ImageFont.truetype(f"{_FONT_DIR}/DejaVuSans-Bold.ttf", 30)
    f_sub = ImageFont.truetype(f"{_FONT_DIR}/DejaVuSans.ttf", 28)
    f_meta = ImageFont.truetype(f"{_FONT_DIR}/DejaVuSans.ttf", 30)
    f_out = ImageFont.truetype(f"{_FONT_DIR}/DejaVuSans-Bold.ttf", 34)
    f_cite = ImageFont.truetype(f"{_FONT_DIR}/DejaVuSansMono.ttf", 24)

    # accent bars
    d.rectangle([0, 0, W, 14], fill=amber)
    d.rectangle([0, H - 14, W, H], fill=amber)

    # brand
    d.text((margin, 56), "LITIGAFORGE AI", font=f_brand, fill=amber)
    d.text((margin, 96), "Daily Judgment Digest", font=f_sub, fill=muted)

    # case name (dynamic size, max 3 lines)
    name = row.get("case_name") or ""
    size = 60 if len(name) <= 42 else (52 if len(name) <= 64 else 44)
    f_name = ImageFont.truetype(f"{_FONT_DIR}/DejaVuSerif-Bold.ttf", size)
    name_lines = _wrap(name, f_name, W - 2 * margin, 3)
    y = 190
    for ln in name_lines:
        d.text((margin, y), ln, font=f_name, fill=white)
        y += int(size * 1.22)

    # court · year
    court = row.get("court") or ""
    yr = row.get("year") or ""
    meta = f"{court}   ·   {yr}" if yr else court
    y += 24
    d.text((margin, y), meta, font=f_meta, fill=muted)
    y += 56

    # outcome (amber, max 2 lines)
    outcome = row.get("outcome") or ""
    if outcome:
        for ln in _wrap(outcome, f_out, W - 2 * margin, 2):
            d.text((margin, y), ln, font=f_out, fill=amber)
            y += 44

    # citation bottom-right
    cite = row.get("citation") or ""
    if cite:
        cw = f_cite.getlength(cite)
        d.text((W - margin - cw, H - 64), cite, font=f_cite, fill=muted)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@router.get("/judgments/og/{court_slug}/{year}/{slug}.png")
@limiter.limit("120/minute")
async def judgment_og_image(request: Request, court_slug: str, year: int, slug: str):
    row = await fetchrow(
        """SELECT case_name, court, year, outcome, citation
           FROM judgments
           WHERE court_slug = $1 AND year = $2 AND slug = $3 AND status = 'published'""",
        court_slug, year, slug,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Judgment not found")
    try:
        png = _render_og(row)
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("OG render failed: %s", e)
        raise HTTPException(status_code=500, detail="OG image render failed")
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )
