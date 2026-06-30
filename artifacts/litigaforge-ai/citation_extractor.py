"""
citation_extractor.py — Indian legal citation extraction for LitigaForge AI

Covers the most common Indian citation reporters:
  SCC         (2017) 10 SCC 1
  SCC OnLine  2019 SCC OnLine SC 123
  AIR         AIR 2019 SC 123
  HC reporters BomLR, MLJ, DLT, KLT, ILR etc.
  Manupatra   MANU/SC/0001/2019

Public API:
  extract_citations_sync(text)        → list[dict]  (pure regex, no I/O)
  extract_citations(text, full_text)  → list[dict]  (async, DB-enriched)
  linkify_citations_md(text)          → str  markdown [raw](ik_url)
  linkify_citations_html(text, cites) → str  HTML <a> tags (pre-resolved)

Each citation dict has keys:
  raw           — as found in the source text
  normalized    — whitespace-collapsed, stripped
  ik_link       — IndianKanoon search URL (always present)
  internal_path — "/judgments/{court}/{year}/{slug}" or None
  kind          — "scc" | "scc_online" | "air" | "hc_reporter" | "manu"

Fail-open: any DB error leaves internal_path = None without raising.
"""
import logging
import re
from urllib.parse import quote_plus

logger = logging.getLogger("litigaforge.citations")

SITE_URL = "https://litigaforge.com"
_IK_SEARCH = "https://indiankanoon.org/search/?formInput="

# Court abbreviations used in AIR and SCC OnLine citations
_HC_ABBR = r"(?:SC|HC|Bom|Mad|Del|Cal|All|AP|Ker|Guj|Raj|MP|Pat|Ori|Pun|P&?H|J&?K|Hyd|Kar|Gau|Sim|Uts|Chhatt|HP|Jhark)"

# Patterns ordered so that more-specific variants are checked first to prevent
# a shorter prefix from consuming part of a longer citation.
_PATTERNS = [
    # SCC OnLine must precede plain SCC (both contain "SCC")
    ("scc_online", re.compile(
        r"\d{4}\s+SCC\s+OnLine\s+" + _HC_ABBR + r"\s+\d+",
        re.IGNORECASE,
    )),
    # SCC (plain): requires leading parenthesised year — prevents overlap with SCC OnLine
    ("scc", re.compile(
        r"\(\d{4}\)\s*\d+\s+SCC\s+\d+",
    )),
    # AIR
    ("air", re.compile(
        r"\bAIR\s+\d{4}\s+" + _HC_ABBR + r"\s+\d+",
        re.IGNORECASE,
    )),
    # Major HC reporters (optional volume in parens)
    ("hc_reporter", re.compile(
        r"\d{4}\s+(?:\(\d+\)\s+)?(?:BomLR|MLJ|DLT|KLT|GLR|ILR|APLJ|CLJ)\s+\d+",
        re.IGNORECASE,
    )),
    # Manupatra neutral citation MANU/CourtCode/SerialNo/Year
    ("manu", re.compile(
        r"\bMANU/[A-Z]{1,10}/\d+/\d{4}\b",
    )),
]


def _normalize(raw: str) -> str:
    return re.sub(r"\s+", " ", raw).strip()


def _ik_link(citation: str) -> str:
    return _IK_SEARCH + quote_plus(citation)


def extract_citations_sync(text: str) -> list:
    """
    Pure regex extraction — no I/O, safe to call synchronously.
    Returns list of dicts with keys: raw, normalized, ik_link, internal_path (None), kind.
    Deduplicates by lowercase-normalized form; longer match wins on overlap.
    """
    if not text:
        return []

    found: list = []
    seen: set = set()

    for kind, pat in _PATTERNS:
        for m in pat.finditer(text):
            raw = m.group(0)
            norm = _normalize(raw)
            key = norm.lower()
            if key in seen:
                continue
            seen.add(key)
            found.append({
                "raw": raw,
                "normalized": norm,
                "ik_link": _ik_link(norm),
                "internal_path": None,
                "kind": kind,
            })

    return found


async def extract_citations(text: str, full_text: str = "") -> list:
    """
    Regex extraction + batched DB lookup for internal_path.
    internal_path is set to "/judgments/{court}/{year}/{slug}" when the
    extracted citation string is found inside a stored judgment's citation column.

    Uses a single DB query (fetch all published citation strings, match in Python)
    rather than N per-citation queries.

    Fail-open: any DB error returns regex-only results with internal_path = None.
    """
    combined = (text or "") + " " + (full_text or "")
    cites = extract_citations_sync(combined)
    if not cites:
        return cites

    try:
        from database import fetch as db_fetch
        rows = await db_fetch(
            "SELECT court_slug, year, slug, citation FROM judgments "
            "WHERE status = 'published' AND citation IS NOT NULL AND citation <> ''",
        )
        # Build a lookup: normalized-db-citation-lower → internal_path
        db_map: dict = {}
        for r in rows:
            db_cite_lower = (r["citation"] or "").lower().strip()
            if db_cite_lower:
                path = f"/judgments/{r['court_slug']}/{r['year']}/{r['slug']}"
                db_map[db_cite_lower] = path

        for c in cites:
            norm_lower = c["normalized"].lower()
            # Exact match first
            if norm_lower in db_map:
                c["internal_path"] = db_map[norm_lower]
                continue
            # Substring: extracted citation is contained within DB's citation field
            for db_key, path in db_map.items():
                if norm_lower in db_key or db_key in norm_lower:
                    c["internal_path"] = path
                    break

    except Exception as exc:
        logger.warning("citation_extractor: DB lookup failed: %s", exc)

    return cites


def _best_url(cite: dict) -> str:
    """Return absolute internal URL if matched in DB, else IndianKanoon link."""
    if cite.get("internal_path"):
        return SITE_URL + cite["internal_path"]
    return cite["ik_link"]


def linkify_citations_md(text: str) -> str:
    """
    Wrap Indian legal citations in text with markdown hyperlinks [raw](ik_url).
    Uses IndianKanoon links only (no DB lookup). Intended for blog article bodies.
    Replaces longest matches first to avoid nested substitutions.
    """
    if not text:
        return text
    cites = extract_citations_sync(text)
    if not cites:
        return text
    cites_sorted = sorted(cites, key=lambda c: len(c["raw"]), reverse=True)
    result = text
    replaced: set = set()
    for c in cites_sorted:
        raw = c["raw"]
        if raw in replaced:
            continue
        replaced.add(raw)
        result = result.replace(raw, f"[{raw}]({c['ik_link']})")
    return result


def linkify_citations_html(text: str, cites: list) -> str:
    """
    Replace citation occurrences in plain text with HTML <a> tags.
    cites should come from extract_citations() or extract_citations_sync()
    so internal_path is already resolved where possible.
    Does NOT double-escape text that already contains HTML — call only on
    plain-text strings before HTML-escaping the surrounding context.
    """
    import html as _html
    if not text or not cites:
        return text
    cites_sorted = sorted(cites, key=lambda c: len(c["raw"]), reverse=True)
    result = text
    replaced: set = set()
    for c in cites_sorted:
        raw = c["raw"]
        if raw in replaced:
            continue
        replaced.add(raw)
        url = _best_url(c)
        safe_url = _html.escape(url, quote=True)
        safe_raw = _html.escape(raw)
        link = (
            f'<a href="{safe_url}" '
            f'style="color:#1a2744;font-weight:600;text-decoration:underline;" '
            f'target="_blank" rel="noopener noreferrer">{safe_raw}</a>'
        )
        result = result.replace(raw, link)
    return result
