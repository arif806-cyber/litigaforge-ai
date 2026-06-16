"""
LitigaForge AI — Judgment ingestion (Phase 2).

Populates the ``judgments`` table from a COMPLIANT official source and generates
AI summaries (English + Hindi, acts cited, derived outcome).

Compliance
----------
indiankanoon.org's website and the eCourts / High Court portals are NOT
scrapable — they sit behind Cloudflare anti-bot, CAPTCHA, and ToS that prohibit
automated crawling. The only compliant path is an official API. This module
integrates IndianKanoon's **official API** (https://api.indiankanoon.org),
gated behind the ``INDIANKANOON_API_TOKEN`` secret.

Behaviour
---------
  • ``INDIANKANOON_API_TOKEN`` UNSET  → benign no-op. Logs "no compliant source
    configured" and returns. NEVER scrapes, NEVER fabricates data.
  • token SET + API/auth/network failure → FAILS LOUD (logs error + raises).
    NEVER falls back to scraping or sample/placeholder data.

A daily 06:00 IST scheduler (production only) runs :func:`run_ingestion`. Off
production the scheduler stays disabled; with no token each run is a benign
no-op.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

import requests as _req
from asyncpg.exceptions import UniqueViolationError as UniqueViolation

from database import fetchval, get_pool
from logger import get_logger

logger = get_logger("litigaforge.judgment_ingest")

# ── Source configuration ──────────────────────────────────────────────────────

API_BASE = "https://api.indiankanoon.org"
SOURCE_NAME = "IndianKanoon"
USER_AGENT = "litigaforge-judgment-ingest/1.0"

MIN_REQUEST_INTERVAL = 2.5   # seconds between API calls (polite; spec wants >=2s)
REQUEST_TIMEOUT = 45         # per-request timeout (seconds)
MAX_RETRIES = 3              # transient (5xx / 429 / network) retries
DEFAULT_MAX_DOCS = 10        # max NEW judgments ingested per run
AI_TEXT_BUDGET = 12000       # chars of judgment text sent to the model
FULL_TEXT_CAP = 200000       # chars of judgment text stored in the DB

# Advisory-lock key — prevents overlapping runs (scheduler vs manual trigger,
# and any future multi-instance scale-out).
_LOCK_KEY = 7780026

# Default "recent judgments" queries. Free-text court names + IndianKanoon's
# documented ``sortby: mostrecent`` operator — robust without guessing IK's
# internal doctype codes. LitigaForge targets Telangana & AP, so those High
# Courts lead. Override via the JUDGMENT_INGEST_QUERIES env var
# (semicolon-separated formInput strings).
DEFAULT_QUERIES: list[tuple[str, str]] = [
    ("Supreme Court of India", "doctypes: supremecourt sortby: mostrecent"),
    ("Telangana High Court", "telangana high court sortby: mostrecent"),
    ("Andhra Pradesh High Court", "andhra pradesh high court sortby: mostrecent"),
]


def _token() -> str:
    return (os.getenv("INDIANKANOON_API_TOKEN") or "").strip()


def is_source_configured() -> bool:
    """True only when a compliant API token is present. No token = no ingestion."""
    return bool(_token())


def _is_prod() -> bool:
    """Fail-closed production detection — ANY production signal counts. Mirrors
    routers/paid_documents.py so an unset ENVIRONMENT in a real deployment never
    accidentally toggles behaviour."""
    if (os.getenv("REPLIT_DEPLOYMENT") or "").strip():
        return True
    if (os.getenv("NODE_ENV") or "").strip().lower() == "production":
        return True
    return (os.getenv("ENVIRONMENT") or "development").strip().lower() in ("production", "prod")


def _max_docs() -> int:
    try:
        return max(1, int(os.getenv("JUDGMENT_INGEST_MAX_DOCS", str(DEFAULT_MAX_DOCS))))
    except ValueError:
        return DEFAULT_MAX_DOCS


def _queries() -> list[tuple[str, str]]:
    raw = (os.getenv("JUDGMENT_INGEST_QUERIES") or "").strip()
    if not raw:
        return DEFAULT_QUERIES
    out: list[tuple[str, str]] = []
    for part in raw.split(";"):
        q = part.strip()
        if q:
            out.append((q[:60], q))
    return out or DEFAULT_QUERIES


# ── IndianKanoon API client ───────────────────────────────────────────────────

class IndianKanoonError(RuntimeError):
    """Raised when the configured compliant source fails. Never swallowed into a
    fake/scraped fallback."""


class IndianKanoonClient:
    """Thin client for the official IndianKanoon API.

    All IK API calls are POST with an ``Authorization: Token <key>`` header.
    Requests are throttled to >= MIN_REQUEST_INTERVAL apart and retried on
    transient failures; auth failures raise immediately (fail loud).
    """

    _throttle_lock = threading.Lock()
    _last_request = 0.0

    def __init__(self, token: str):
        if not token:
            raise IndianKanoonError("IndianKanoon API token is required")
        self._headers = {
            "Authorization": f"Token {token}",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }

    @classmethod
    def _wait_turn(cls) -> None:
        with cls._throttle_lock:
            elapsed = time.monotonic() - cls._last_request
            if elapsed < MIN_REQUEST_INTERVAL:
                time.sleep(MIN_REQUEST_INTERVAL - elapsed)
            cls._last_request = time.monotonic()

    def _post(self, path: str) -> dict:
        url = f"{API_BASE}{path}"
        last_err: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 1):
            self._wait_turn()
            try:
                r = _req.post(url, headers=self._headers, timeout=REQUEST_TIMEOUT)
            except _req.RequestException as e:
                last_err = e
                logger.warning("[IK] %s network error (attempt %d/%d): %s",
                               path, attempt, MAX_RETRIES, e)
                time.sleep(min(2 ** attempt, 10))
                continue
            if r.status_code in (401, 403):
                # Auth/permission failure is terminal — never retry, never fake.
                raise IndianKanoonError(
                    f"IndianKanoon auth failed (HTTP {r.status_code}). Check INDIANKANOON_API_TOKEN."
                )
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError as e:
                    raise IndianKanoonError(f"IndianKanoon returned non-JSON for {path}: {e}")
            if r.status_code == 429 or r.status_code >= 500:
                last_err = IndianKanoonError(f"HTTP {r.status_code}")
                logger.warning("[IK] %s HTTP %s (attempt %d/%d)",
                               path, r.status_code, attempt, MAX_RETRIES)
                time.sleep(min(2 ** attempt, 10))
                continue
            # Other 4xx — terminal.
            raise IndianKanoonError(f"IndianKanoon error for {path}: HTTP {r.status_code} {r.text[:200]}")
        raise IndianKanoonError(f"IndianKanoon request failed after {MAX_RETRIES} attempts: {last_err}")

    def search(self, form_input: str, pagenum: int = 0) -> list[dict]:
        from urllib.parse import quote_plus
        path = f"/search/?formInput={quote_plus(form_input)}&pagenum={pagenum}"
        data = self._post(path)
        docs = data.get("docs")
        return docs if isinstance(docs, list) else []

    def get_doc(self, tid: Any) -> dict:
        data = self._post(f"/doc/{tid}/")
        return data if isinstance(data, dict) else {}


# ── Normalisation helpers ─────────────────────────────────────────────────────

_SLUG_RE = re.compile(r"[^a-z0-9]+")
_ON_DATE_RE = re.compile(r"\s+on\s+\d{1,2}\s+\w+,?\s+\d{4}\s*$", re.IGNORECASE)


def _slugify(text: str, maxlen: int = 70) -> str:
    s = _SLUG_RE.sub("-", (text or "").lower()).strip("-")
    if len(s) <= maxlen:
        return s or "judgment"
    # Truncate on a word boundary where possible, never mid-token.
    cut = s[:maxlen]
    if "-" in cut:
        cut = cut[: cut.rfind("-")]
    return cut.strip("-") or s[:maxlen].strip("-") or "judgment"


def _disambiguate(slug: str, tid: Any) -> str:
    suffix = f"-{str(tid)[-6:]}"
    base = slug[: 70 - len(suffix)].strip("-")
    return f"{base}{suffix}"


# Stripped from the *slug only* (never the display case_name) to keep slugs in
# clean party1-v-party2 form.
_HONORIFIC_RE = re.compile(
    r"\b(?:justice|hon'?ble|dr|smt|sri|shri|kum|km|mr|mrs|ms|m/s)\.?\b",
    re.IGNORECASE,
)
_VERSUS_RE = re.compile(r"\s+(?:v\.?|vs\.?|versus)\s+", re.IGNORECASE)
_PAREN_RE = re.compile(r"\([^)]*\)")


def _case_slug(case_name: str, maxlen: int = 70) -> str:
    """Build a clean ``party1-v-party2`` slug from a case name.

    GOING-FORWARD SLUG RULE for all newly ingested judgments: the slug is
    derived only from the parties — the version separator (v / vs / versus) is
    folded to ``-v-``, honorifics (Justice, Dr., Smt., Sri, M/s …) and
    parenthetical qualifiers (e.g. ``(Retd.)``, ``(Dead)``) are stripped, and no
    descriptive keyword is ever appended. The display ``case_name`` is left
    untouched.
    """
    t = _PAREN_RE.sub(" ", case_name or "")
    t = _HONORIFIC_RE.sub(" ", t)
    t = _VERSUS_RE.sub(" v ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return _slugify(t, maxlen=maxlen)


def _clean_case_name(title: str) -> str:
    t = (title or "").strip()
    t = _ON_DATE_RE.sub("", t).strip()
    t = re.sub(r"\s+", " ", t)
    return t[:300]


def _map_court(docsource: str) -> Optional[tuple[str, str]]:
    """Map an IK docsource to (court_name, court_slug). Returns None for sources
    outside the Supreme Court / High Court digest scope (tribunals, district
    courts, etc.)."""
    src = (docsource or "").strip()
    low = src.lower()
    if "supreme court" in low:
        return ("Supreme Court of India", "supreme-court-of-india")
    if "high court" in low:
        return (src, _slugify(src))
    return None


def _parse_date(raw: Any) -> tuple[Optional[date], Optional[int]]:
    if not raw:
        return (None, None)
    s = str(raw).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d %B %Y", "%d %b %Y", "%Y/%m/%d"):
        try:
            d = datetime.strptime(s, fmt).date()
            return (d, d.year)
        except ValueError:
            continue
    m = re.search(r"(19|20)\d{2}", s)
    return (None, int(m.group()) if m else None)


_BLOCK_CLOSE_RE = re.compile(
    r"(?i)(</(?:p|div|h[1-6]|li|tr|ul|ol|blockquote|section|article|table)>)"
)
_BR_RE = re.compile(r"(?i)<br\s*/?>")


def _html_to_text(html: str) -> str:
    if not html:
        return ""
    # Preserve block boundaries so adjacent elements don't merge into one word
    # (lxml's text_content concatenates without separators).
    html = _BR_RE.sub("<br/>\n", html)
    html = _BLOCK_CLOSE_RE.sub(r"\n\1", html)
    try:
        import lxml.html
        doc = lxml.html.fromstring(html)
        for bad in doc.xpath("//script | //style"):
            parent = bad.getparent()
            if parent is not None:
                parent.remove(bad)
        text = doc.text_content()
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:FULL_TEXT_CAP]


# ── AI summarisation (ai_brain async cascade, strict JSON) ─────────────────────

_SUMMARY_SYSTEM = (
    "You are an expert Indian legal editor preparing concise, accurate summaries "
    "of court judgments for a public legal digest. You summarise ONLY from the "
    "judgment text provided. You never invent facts, parties, citations, or "
    "statutes. You output STRICT JSON and nothing else."
)


def _build_summary_prompt(case_name: str, court: str, full_text: str, strict: bool) -> str:
    from ai_safety import wrap_user_prompt
    reminder = (
        "\nREMINDER: Return ONLY the JSON object. No markdown, no commentary."
        if strict else ""
    )
    body = wrap_user_prompt(
        f"CASE: {case_name}\nCOURT: {court}\n\nJUDGMENT TEXT:\n{full_text[:AI_TEXT_BUDGET]}"
    )
    return f"""Summarise the following Indian court judgment for a public legal digest.

{body}

Return ONLY a valid JSON object with EXACTLY these keys:
{{
  "summary_en": "3-5 sentence plain-English summary: what the dispute was about and what the court held / decided.",
  "summary_hi": "The same summary in natural Hindi (Devanagari), 3-5 sentences.",
  "acts_cited": ["Statutes/sections actually referenced in the text, e.g. 'Section 138, Negotiable Instruments Act, 1881'. Empty array if none are clearly stated."],
  "outcome": "One short line stating the result, e.g. 'Appeal allowed; conviction set aside.'"
}}

Rules:
- Base everything ONLY on the provided text. Do NOT invent or assume facts, citations, or outcomes.
- If the text is too short or unclear to summarise reliably, return {{"insufficient": true}}.{reminder}"""


def _extract_json_object(text: str) -> dict:
    if not text:
        return {}
    cleaned = re.sub(r"```(?:json)?", "", text).strip().strip("`").strip()
    m = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group())
    except Exception:
        return {}


def _valid_summary(obj: dict) -> Optional[dict]:
    if not isinstance(obj, dict) or obj.get("insufficient"):
        return None
    en = (obj.get("summary_en") or "").strip()
    hi = (obj.get("summary_hi") or "").strip()
    outcome = (obj.get("outcome") or "").strip()
    if len(en) < 40 or len(hi) < 10 or not outcome:
        return None
    acts_raw = obj.get("acts_cited") or []
    acts = [str(a).strip() for a in acts_raw if isinstance(a, (str, int)) and str(a).strip()][:25]
    return {
        "summary_en": en[:4000],
        "summary_hi": hi[:4000],
        "acts_cited": acts,
        "outcome": outcome[:400],
    }


async def _summarize(case_name: str, court: str, full_text: str) -> Optional[dict]:
    """Run the ai_brain cascade and return a validated summary dict, or None to
    skip (after one retry). Never returns fabricated/partial content."""
    from ai_brain import (
        _call_claude_async, _call_openai_async,
        _call_groq_async, _call_gemini_async,
    )
    from llm import legal_llm
    # Portable LiteLLM layer is the PRIMARY summariser; the ai_brain
    # multi-provider cascade stays as the fallback. legal_llm.acomplete shares
    # the (system, user, temperature, max_tokens) signature, so it slots in.
    cascade = (_call_claude_async, _call_openai_async, _call_groq_async, _call_gemini_async)
    if legal_llm.is_configured():
        cascade = (legal_llm.acomplete,) + cascade
    for strict in (False, True):
        prompt = _build_summary_prompt(case_name, court, full_text, strict)
        for caller in cascade:
            try:
                raw = await caller(_SUMMARY_SYSTEM, prompt, 0.2, 2000)
            except Exception as e:  # individual model error — try the next one
                logger.warning("[IK] summary model error: %s", e)
                raw = None
            if not raw:
                continue
            result = _valid_summary(_extract_json_object(raw))
            if result:
                return result
    logger.warning("[IK] could not produce a valid summary for '%s' — skipping", case_name[:80])
    return None


# ── Dedup + upsert ─────────────────────────────────────────────────────────────

async def _already_have(source_url: str) -> bool:
    found = await fetchval("SELECT 1 FROM judgments WHERE source_url = $1", source_url)
    return bool(found)


async def _insert_one(row: dict) -> Optional[int]:
    return await fetchval(
        """INSERT INTO judgments
               (case_name, court, court_slug, bench, judgment_date, year, slug,
                full_text, summary_en, summary_hi, acts_cited, outcome,
                source_url, source_name, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'published')
           ON CONFLICT (court_slug, year, slug) DO NOTHING
           RETURNING id""",
        row["case_name"], row["court"], row["court_slug"], row.get("bench"),
        row.get("judgment_date"), row["year"], row["slug"], row.get("full_text"),
        row["summary_en"], row["summary_hi"], row.get("acts_cited") or [],
        row["outcome"], row["source_url"], SOURCE_NAME,
    )


async def _insert(row: dict, tid: Any) -> bool:
    try:
        new_id = await _insert_one(row)
        if new_id:
            return True
        # Slug collided with a DIFFERENT case (source_url pre-check already ruled out
        # a true duplicate). Disambiguate with a short tid suffix and retry once.
        row2 = {**row, "slug": _disambiguate(row["slug"], tid)}
        return bool(await _insert_one(row2))
    except UniqueViolation:
        # An out-of-band writer inserted this source_url between our pre-check and
        # this insert; the partial unique index on source_url rejected the dupe.
        # Treat as an existing row (dedup-safe), not a run-killing failure.
        logger.info("[IK] source_url already present (race) — skipping: %s",
                    row.get("source_url"))
        return False


# ── Orchestration ──────────────────────────────────────────────────────────────

def _new_stats() -> dict:
    return {
        "status": "pending", "source_configured": False, "fetched": 0,
        "inserted": 0, "skipped_existing": 0, "skipped_out_of_scope": 0,
        "skipped_no_summary": 0, "queries": [],
    }


async def _do_run(stats: dict, max_docs: int) -> None:
    client = IndianKanoonClient(_token())
    remaining = max_docs
    for label, form_input in _queries():
        if remaining <= 0:
            break
        qstat = {"query": label, "found": 0, "inserted": 0}
        docs = await asyncio.to_thread(client.search, form_input)
        qstat["found"] = len(docs)
        stats["fetched"] += len(docs)
        for d in docs:
            if remaining <= 0:
                break
            tid = d.get("tid")
            if tid is None:
                continue
            mapped = _map_court(d.get("docsource") or "")
            if not mapped:
                stats["skipped_out_of_scope"] += 1
                continue
            court, court_slug = mapped
            source_url = f"https://indiankanoon.org/doc/{tid}/"
            if await _already_have(source_url):
                stats["skipped_existing"] += 1
                continue

            doc = await asyncio.to_thread(client.get_doc, tid)
            full_text = _html_to_text(doc.get("doc") or "")
            case_name = _clean_case_name(doc.get("title") or d.get("title") or "")
            jdate, year = _parse_date(doc.get("publishdate") or d.get("publishdate"))
            if not case_name or not year or len(full_text) < 200:
                stats["skipped_no_summary"] += 1
                continue

            summary = await _summarize(case_name, court, full_text)
            if not summary:
                stats["skipped_no_summary"] += 1
                continue

            row = {
                "case_name": case_name, "court": court, "court_slug": court_slug,
                "bench": (doc.get("bench") or "").strip() or None,
                "judgment_date": jdate, "year": year,
                "slug": _case_slug(case_name), "full_text": full_text,
                "summary_en": summary["summary_en"], "summary_hi": summary["summary_hi"],
                "acts_cited": summary["acts_cited"], "outcome": summary["outcome"],
                "source_url": source_url,
            }
            if await _insert(row, tid):
                stats["inserted"] += 1
                qstat["inserted"] += 1
                remaining -= 1
                logger.info("[IK] ingested: %s (%s, %s)", case_name[:80], court_slug, year)
            else:
                stats["skipped_existing"] += 1
        stats["queries"].append(qstat)


async def run_ingestion(max_docs: Optional[int] = None, *, trigger: str = "scheduler") -> dict:
    """Run one ingestion pass.

    Returns a stats dict. Benign no-op (no error) when no compliant source is
    configured. Raises :class:`IndianKanoonError` (fails loud) when a configured
    source is unavailable — never falls back to scraping or fabricated data.
    """
    stats = _new_stats()
    if not is_source_configured():
        logger.warning(
            "judgment-ingest [%s]: no compliant source configured — skipping. "
            "Set INDIANKANOON_API_TOKEN to enable ingestion. (No scraping is ever performed.)",
            trigger,
        )
        stats["status"] = "no_source_configured"
        return stats

    stats["source_configured"] = True
    cap = max_docs if (max_docs and max_docs > 0) else _max_docs()

    pool = await get_pool()
    lock_conn = await pool.acquire()
    try:
        got_lock = await lock_conn.fetchval("SELECT pg_try_advisory_lock($1)", _LOCK_KEY)
        if not got_lock:
            logger.info("judgment-ingest [%s]: another run holds the lock — skipping", trigger)
            stats["status"] = "locked"
            return stats
        try:
            logger.info("judgment-ingest [%s]: starting (max_docs=%d)", trigger, cap)
            await _do_run(stats, cap)
            stats["status"] = "ok"
            logger.info("judgment-ingest [%s]: done — %s", trigger, stats)
        finally:
            await lock_conn.fetchval("SELECT pg_advisory_unlock($1)", _LOCK_KEY)
    finally:
        await pool.release(lock_conn)
    return stats


# ── Daily scheduler (production only) ──────────────────────────────────────────

# 06:00 IST == 00:30 UTC (IST = UTC+5:30).
_RUN_HOUR_UTC = 0
_RUN_MINUTE_UTC = 30


def _next_run(now_utc: datetime) -> datetime:
    target = now_utc.replace(hour=_RUN_HOUR_UTC, minute=_RUN_MINUTE_UTC, second=0, microsecond=0)
    if target <= now_utc:
        target += timedelta(days=1)
    return target


async def _scheduler_loop() -> None:
    while True:
        now = datetime.now(timezone.utc)
        nxt = _next_run(now)
        delay = (nxt - now).total_seconds()
        logger.info(
            "judgment-ingest: next run at %s UTC (06:00 IST) — in %.1f h",
            nxt.isoformat(), delay / 3600,
        )
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            logger.info("judgment-ingest: scheduler cancelled")
            raise
        try:
            await run_ingestion(trigger="scheduler")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            # Fail LOUD (error log) but keep the daily loop alive.
            logger.error("judgment-ingest: scheduled run failed: %s", e, exc_info=True)


def start_scheduler() -> Optional["asyncio.Task"]:
    """Start the daily ingestion scheduler. Production only; returns the task
    handle (or None when disabled) so the caller can cancel it on shutdown."""
    if not _is_prod():
        logger.info("judgment-ingest: non-production environment — daily scheduler disabled")
        return None
    if not is_source_configured():
        logger.info(
            "judgment-ingest: production scheduler started, but no compliant source "
            "is configured yet — runs will no-op until INDIANKANOON_API_TOKEN is set"
        )
    else:
        logger.info("judgment-ingest: production daily scheduler enabled (06:00 IST)")
    return asyncio.create_task(_scheduler_loop())
