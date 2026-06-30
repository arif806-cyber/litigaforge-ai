"""
Indian Legal NLP Layer — LitigaForge AI

Two public helpers:

  extract_acts(text)        → list[str]
      Deterministic regex extraction of Indian statutes and sections.
      No model download, no dependencies beyond stdlib. Always returns a list
      (may be empty). Normalises results and deduplicates.

  extract_entities(text)    → dict | None   (async)
      Calls the HuggingFace Inference API with the OpenNyAI legal NER model
      (opennyai/legal_ner_token_classifier) to tag judges, parties, courts,
      and statutes. Returns None gracefully if HF_API_TOKEN is absent or
      any error occurs — never raises. Requires HF_API_TOKEN env var.

Both functions are fail-open: errors are logged at WARNING level and the
existing ingestion pipeline continues unaffected.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Optional

logger = logging.getLogger("litigaforge.legal_nlp")

# ── HuggingFace config ─────────────────────────────────────────────────────────

_HF_NER_MODEL = os.getenv(
    "HF_NER_MODEL",
    "opennyai/legal_ner_token_classifier",
)
_HF_API_BASE = "https://api-inference.huggingface.co/models"
_HF_TIMEOUT = float(os.getenv("HF_NER_TIMEOUT", "30"))


def legal_nlp_enabled() -> bool:
    """True when HF_API_TOKEN is configured (enables extract_entities)."""
    return bool(os.getenv("HF_API_TOKEN", "").strip())


# ── Indian Statute Regex Patterns ─────────────────────────────────────────────
#
# Design notes:
#  • _NAMED_ACT_RE: NOT case-insensitive. Act names are proper nouns — each
#    word must start with [A-Z]. Only a small set of lowercase connectors
#    (of, for, to, and, in, the) are allowed between title-case words.
#    This prevents "the order passed under ..." from being captured.
#  • _SEC_FULL_ACT_RE: case-insensitive for "Section/Sections" keyword only.
#  • _CONSTITUTION_RE / _SCHEDULE_RE: case-insensitive (always titled the same
#    but citations vary in style).
#  • _SHORTFORM_RE: case-insensitive (IPC, ipc, I.P.C. all valid in Indian text).

# ── Pattern 1: Section N of the [Act Name] ────────────────────────────────────
# Matches: "Section 138 of the Negotiable Instruments Act, 1881"
#          "Sections 34 and 302 IPC"
#          "Section 482 Cr.P.C."
_SEC_FULL_ACT_RE = re.compile(
    r"\bSections?\s+"
    r"(\d+[A-Za-z]?"                        # section number(s)
    r"(?:\s*(?:,|and|&|r/?w\.?)\s*\d+[A-Za-z]?)*)"
    r"(?:\s+read\s+with\s+Section\s+\d+[A-Za-z]?)?"
    r"\s+(?:of\s+the\s+|of\s+)?"           # optional "of the"
    r"([A-Z][A-Za-z\(\)\-]*"               # Act name: first word must be capital
    r"(?:\s+(?:[A-Z][A-Za-z\(\)\-]*|of|for|to|and|in|the|under|with)){0,10}?"
    r"\s+(?:Act|Code|Rules|Regulations|Ordinance|Amendment)"
    r"(?:,?\s*\d{4})?)\b",
    re.IGNORECASE,  # only for "Section/Sections" keyword, not act-name casing check
)

# ── Pattern 2: Named Acts (proper nouns only) ─────────────────────────────────
# Matches: "the Consumer Protection Act, 2019"
#          "the Hindu Marriage Act, 1955"
#          "the Right to Information Act, 2005"
# Does NOT match: "the order passed under ..." (lowercase "order" ≠ Act name)
#
# Each word in the Act name must start with a capital letter or be a known
# lowercase connector. "Order" is excluded from act suffixes to prevent
# "the order passed" from matching.
_CAP = r"[A-Z][A-Za-z\(\)\-&]*"
_CONN = r"(?:of|for|to|and|in|the|under|with|on|a|an)"
_NAMED_ACT_RE = re.compile(
    r"(?<!\w)[Tt]he\s+"
    r"((?:" + _CAP + r"|" + _CONN + r")"
    r"(?:\s+(?:" + _CAP + r"|" + _CONN + r")){0,12}?"
    r"\s+(?:Act|Code|Rules|Regulations|Ordinance)"
    r"(?:,?\s*\d{4})?)\b"
)

# ── Pattern 3: Constitutional provisions ──────────────────────────────────────
# Matches: "Article 21", "Article 14(1)(a)", "Article 370 of the Constitution"
_ARTICLE_RE = re.compile(
    r"\b(Article\s+\d+[A-Z]?(?:\([^)]{1,20}\))*"
    r"(?:\s+(?:of\s+)?(?:the\s+)?Constitution(?:\s+of\s+India)?)?)\b",
    re.IGNORECASE,
)
_SCHEDULE_RE = re.compile(
    r"\b((?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|"
    r"Eleventh|Twelfth)\s+Schedule|Schedule\s+[IVX]+)\b",
    re.IGNORECASE,
)
_LIST_ENTRY_RE = re.compile(
    r"\b((?:Union\s+List|State\s+List|Concurrent\s+List|List\s+I{1,3})"
    r"(?:,?\s*Entry\s+\d+)?)\b",
    re.IGNORECASE,
)

# ── Pattern 4: Short-form abbreviations ────────────────────────────────────────
# Expanded to canonical names via _SHORTFORM_EXPAND.
_SHORTFORM_RE = re.compile(
    r"\b(I\.P\.C\.?|C\.P\.C\.?|Cr\.?P\.?C\.?|CrPC|IPC|CPC|"
    r"IT\s+Act|SARFAESI|PMLA|NDPS|POCSO|RTI\s+Act|RTI|"
    r"MV\s+Act|NI\s+Act|N\.I\.\s*Act|FEMA|GST\s+Act|"
    r"Income\s+Tax\s+Act|Hindu\s+Marriage\s+Act|Hindu\s+Succession\s+Act|"
    r"Arbitration\s+Act|Companies\s+Act)\b",
    re.IGNORECASE,
)

_SHORTFORM_EXPAND: dict[str, str] = {
    "ipc": "Indian Penal Code, 1860",
    "i.p.c.": "Indian Penal Code, 1860",
    "i.p.c": "Indian Penal Code, 1860",
    "cpc": "Code of Civil Procedure, 1908",
    "c.p.c.": "Code of Civil Procedure, 1908",
    "c.p.c": "Code of Civil Procedure, 1908",
    "crpc": "Code of Criminal Procedure, 1973",
    "cr.p.c.": "Code of Criminal Procedure, 1973",
    "cr.pc.": "Code of Criminal Procedure, 1973",
    "crp.c.": "Code of Criminal Procedure, 1973",
    "it act": "Information Technology Act, 2000",
    "sarfaesi": "Securitisation and Reconstruction of Financial Assets and Enforcement of Securities Interest Act, 2002",
    "pmla": "Prevention of Money Laundering Act, 2002",
    "ndps": "Narcotic Drugs and Psychotropic Substances Act, 1985",
    "pocso": "Protection of Children from Sexual Offences Act, 2012",
    "rti act": "Right to Information Act, 2005",
    "rti": "Right to Information Act, 2005",
    "mv act": "Motor Vehicles Act, 1988",
    "ni act": "Negotiable Instruments Act, 1881",
    "n.i. act": "Negotiable Instruments Act, 1881",
    "n.i.act": "Negotiable Instruments Act, 1881",
    "fema": "Foreign Exchange Management Act, 1999",
    "companies act": "Companies Act, 2013",
    "gst act": "Goods and Services Tax Act, 2017",
    "income tax act": "Income Tax Act, 1961",
    "hindu marriage act": "Hindu Marriage Act, 1955",
    "hindu succession act": "Hindu Succession Act, 1956",
    "arbitration act": "Arbitration and Conciliation Act, 1996",
}

_MIN_ACT_LEN = 6
_MAX_ACTS = 30


def _normalise_act(raw: str) -> str:
    """Strip leading 'the', collapse whitespace, strip trailing punctuation."""
    s = re.sub(r"^(?:[Tt]he\s+)", "", raw.strip())
    s = re.sub(r"\s+", " ", s).strip().rstrip(".,;")
    return s


def _expand_shortform(raw: str) -> str:
    key = re.sub(r"\s+", " ", raw.strip().lower())
    return _SHORTFORM_EXPAND.get(key, raw.strip())


def extract_acts(text: str) -> list[str]:
    """Extract Indian statutes and sections from judgment text using regex patterns.

    Returns a deduplicated list of statute strings, e.g.:
      ["Section 138, Negotiable Instruments Act, 1881",
       "Article 21, Constitution of India",
       "Indian Penal Code, 1860"]

    Always succeeds — never raises. Returns [] on error or empty input.
    """
    if not text or not text.strip():
        return []
    try:
        return _extract_acts_inner(text)
    except Exception as e:
        logger.warning("[legal_nlp] extract_acts error: %s", e)
        return []


def _extract_acts_inner(text: str) -> list[str]:
    seen: set[str] = set()
    results: list[str] = []

    def _add(item: str) -> None:
        item = item.strip().rstrip(".,;")
        key = re.sub(r"\s+", " ", item.lower()).strip()
        if key and len(key) >= _MIN_ACT_LEN and key not in seen:
            seen.add(key)
            results.append(item)

    # ── Pattern 1: Section N of the [Full Act Name] ────────────────────────────
    for m in _SEC_FULL_ACT_RE.finditer(text):
        section_part = m.group(1).strip()
        act_part = _normalise_act(m.group(2))
        if len(act_part) >= _MIN_ACT_LEN:
            _add(f"Section {section_part}, {act_part}")
            # Also add the bare act name so it's deduplicated against Pattern 2
            _add(act_part)

    # ── Pattern 2: Named Acts ──────────────────────────────────────────────────
    for m in _NAMED_ACT_RE.finditer(text):
        act = _normalise_act(m.group(1))
        # "Constitution of India and the Consumer Protection Act" — "and the [Capital]"
        # is a sentence conjunction, not part of the Act name. Strip the prefix.
        act = re.sub(r'^.*?\band\s+the\s+(?=[A-Z])', '', act, flags=re.IGNORECASE).strip()
        if len(act) >= _MIN_ACT_LEN:
            _add(act)

    # ── Pattern 3: Constitutional provisions ──────────────────────────────────
    for m in _ARTICLE_RE.finditer(text):
        prov = re.sub(r"\s+", " ", m.group(1)).strip()
        if "constitution" in prov.lower():
            _add(prov)
        else:
            # Bare "Article 21" — only include when Constitution context nearby
            start = max(0, m.start() - 80)
            end = min(len(text), m.end() + 80)
            ctx = text[start:end].lower()
            if "constitution" in ctx or "fundamental right" in ctx:
                _add(prov + ", Constitution of India")

    for m in _SCHEDULE_RE.finditer(text):
        _add(m.group(1).strip() + ", Constitution of India")

    for m in _LIST_ENTRY_RE.finditer(text):
        _add(m.group(1).strip() + ", Constitution of India")

    # ── Pattern 4: Short-form abbreviations ────────────────────────────────────
    for m in _SHORTFORM_RE.finditer(text):
        _add(_expand_shortform(m.group(1)))

    return results[:_MAX_ACTS]


# ── HuggingFace NER (OpenNyAI legal NER token classifier) ─────────────────────

_LABEL_MAP = {
    "JUDGE": "judges",
    "PETITIONER": "parties",
    "RESPONDENT": "parties",
    "LAWYER": "parties",
    "COURT": "courts",
    "ORG": "courts",
    "STATUTE": "statutes",
    "PROVISION": "statutes",
}


async def extract_entities(text: str) -> Optional[dict]:
    """Call HF Inference API (opennyai/legal_ner_token_classifier) for NER.

    Returns:
        {"parties": [...], "courts": [...], "judges": [...], "statutes": [...]}
        or None if HF_API_TOKEN is absent or any error occurs.

    Uses only the first 4096 chars to stay within model limits. Safe to call
    in a background asyncio.create_task — never raises.
    """
    token = os.getenv("HF_API_TOKEN", "").strip()
    if not token:
        return None
    try:
        return await _call_hf_ner(text[:4096], token)
    except Exception as e:
        logger.warning("[legal_nlp] extract_entities error: %s", e)
        return None


async def _call_hf_ner(text: str, token: str) -> Optional[dict]:
    import httpx

    url = f"{_HF_API_BASE}/{_HF_NER_MODEL}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=_HF_TIMEOUT) as client:
        resp = await client.post(url, json={"inputs": text}, headers=headers)

    if resp.status_code == 503:
        logger.info("[legal_nlp] HF model loading (503) — skipping entity extraction")
        return None
    if resp.status_code != 200:
        logger.warning(
            "[legal_nlp] HF NER HTTP %d: %s", resp.status_code, resp.text[:200]
        )
        return None

    raw = resp.json()
    if not isinstance(raw, list):
        return None

    entities: dict[str, set] = {
        "parties": set(), "courts": set(), "judges": set(), "statutes": set(),
    }

    for item in raw:
        if not isinstance(item, dict):
            continue
        label = (item.get("entity_group") or item.get("entity") or "").upper()
        word = re.sub(r"\s*##", "", (item.get("word") or "").strip())
        score = float(item.get("score") or 0.0)
        if not word or len(word) < 2 or score < 0.75:
            continue
        bucket = _LABEL_MAP.get(label)
        if bucket:
            entities[bucket].add(word)

    return {k: sorted(v) for k, v in entities.items()}
