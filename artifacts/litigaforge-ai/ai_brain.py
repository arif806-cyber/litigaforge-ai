"""
LitigaForge AI Brain — Multi-model intelligence layer (all free via Replit).

Three AI providers, each doing what it does best:
  • Gemini 2.5 Flash  — fast entity extraction & intent detection
  • Claude Sonnet 4-6 — deep legal strategy synthesis (best structured writing)
  • GPT-5-mini        — fallback strategy when Claude is busy

Cascade for entity extraction : Gemini → regex
Cascade for strategy synthesis: Claude → GPT-5 → Gemini → smart data template

No API keys needed from the user — all provisioned free via Replit AI Integrations.
"""
import os
import re
import json
import logging
from typing import Dict, Any

import requests as _req

logger = logging.getLogger("litigaforge.ai_brain")

from ai_safety import (
    wrap_user_prompt, add_disclaimer, validate_ai_response,
    strip_generic_fluff, hallucination_guard, safe_ai_output,
    score_injection_risk,
)

# ──────────────────────────────────────────────────────────────────────────────
# Provider registry — lazy-initialised on first call
# ──────────────────────────────────────────────────────────────────────────────

_providers: Dict[str, dict] = {}   # name → {base, ready, ...}


def _init_providers():
    """Probe all three providers once and cache their readiness."""
    global _providers
    if _providers:
        return

    # ── Gemini ──────────────────────────────────────────────────────────────
    gemini_base = os.getenv("AI_INTEGRATIONS_GEMINI_BASE_URL", "").rstrip("/")
    gemini_key  = os.getenv("AI_INTEGRATIONS_GEMINI_API_KEY", "")
    gemini_ready = False
    if gemini_base:
        try:
            url  = f"{gemini_base}/models/gemini-2.5-flash:generateContent"
            hdrs = {"x-goog-api-key": gemini_key, "Content-Type": "application/json"}
            body = {"contents": [{"role": "user", "parts": [{"text": "ping"}]}],
                    "generationConfig": {"maxOutputTokens": 5}}
            r = _req.post(url, json=body, headers=hdrs, timeout=6)
            gemini_ready = r.status_code == 200
        except Exception:
            pass
    _providers["gemini"] = {"base": gemini_base, "key": gemini_key, "ready": gemini_ready}
    logger.info(f"[AI_BRAIN] Gemini: {'✓ ready' if gemini_ready else '✗ unavailable'}")

    # ── Claude ───────────────────────────────────────────────────────────────
    claude_base = os.getenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "").rstrip("/")
    claude_key  = os.getenv("AI_INTEGRATIONS_ANTHROPIC_API_KEY", "")
    claude_ready = False
    if claude_base:
        try:
            hdrs = {"x-api-key": claude_key, "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"}
            body = {"model": "claude-sonnet-4-6", "max_tokens": 10,
                    "messages": [{"role": "user", "content": "ping"}]}
            r = _req.post(f"{claude_base}/messages", json=body, headers=hdrs, timeout=6)
            claude_ready = r.status_code == 200
        except Exception:
            pass
    _providers["claude"] = {"base": claude_base, "key": claude_key, "ready": claude_ready}
    logger.info(f"[AI_BRAIN] Claude Sonnet 4-6: {'✓ ready' if claude_ready else '✗ unavailable'}")

    # ── OpenAI GPT-5 ─────────────────────────────────────────────────────────
    openai_base = os.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL", "").rstrip("/")
    openai_key  = os.getenv("AI_INTEGRATIONS_OPENAI_API_KEY", "")
    openai_ready = False
    if openai_base:
        try:
            hdrs = {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
            body = {"model": "gpt-5-mini",
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_completion_tokens": 5}
            r = _req.post(f"{openai_base}/chat/completions", json=body, headers=hdrs, timeout=6)
            openai_ready = r.status_code == 200
        except Exception:
            pass
    _providers["openai"] = {"base": openai_base, "key": openai_key, "ready": openai_ready}
    logger.info(f"[AI_BRAIN] OpenAI GPT-5-mini: {'✓ ready' if openai_ready else '✗ unavailable'}")

    ready_count = sum(1 for p in _providers.values() if p["ready"])
    logger.info(f"[AI_BRAIN] {ready_count}/3 AI providers active")


def get_active_providers() -> list[str]:
    """Return names of all ready providers."""
    _init_providers()
    return [name for name, p in _providers.items() if p["ready"]]


# ──────────────────────────────────────────────────────────────────────────────
# Low-level callers — one per provider
# ──────────────────────────────────────────────────────────────────────────────

def _call_gemini(system: str, user: str, temperature: float = 0.2,
                 max_tokens: int = 8192) -> str | None:
    _init_providers()
    p = _providers.get("gemini", {})
    if not p.get("ready"):
        return None
    url  = f"{p['base']}/models/gemini-2.5-flash:generateContent"
    hdrs = {"x-goog-api-key": p["key"], "Content-Type": "application/json"}
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    try:
        r = _req.post(url, json=body, headers=hdrs, timeout=50)
        if r.status_code != 200:
            logger.warning(f"[GEMINI] HTTP {r.status_code}: {r.text[:150]}")
            return None
        text = (r.json().get("candidates", [{}])[0]
                         .get("content", {})
                         .get("parts", [{}])[0]
                         .get("text", ""))
        return text.strip() or None
    except Exception as e:
        logger.warning(f"[GEMINI] call failed: {e}")
        return None


def _call_claude(system: str, user: str, temperature: float = 0.3,
                 max_tokens: int = 8000) -> str | None:
    _init_providers()
    p = _providers.get("claude", {})
    if not p.get("ready"):
        return None
    hdrs = {"x-api-key": p["key"], "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"}
    body = {
        "model": "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    try:
        r = _req.post(f"{p['base']}/messages", json=body, headers=hdrs, timeout=90)
        if r.status_code != 200:
            logger.warning(f"[CLAUDE] HTTP {r.status_code}: {r.text[:150]}")
            return None
        content = r.json().get("content", [])
        text = " ".join(c.get("text", "") for c in content if c.get("type") == "text")
        return text.strip() or None
    except Exception as e:
        logger.warning(f"[CLAUDE] call failed: {e}")
        return None


def _call_openai(system: str, user: str, temperature: float = 0.3,
                 max_tokens: int = 8000) -> str | None:
    _init_providers()
    p = _providers.get("openai", {})
    if not p.get("ready"):
        return None
    hdrs = {"Authorization": f"Bearer {p['key']}", "Content-Type": "application/json"}
    body = {
        "model": "gpt-5-mini",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "max_completion_tokens": max_tokens,
    }
    try:
        r = _req.post(f"{p['base']}/chat/completions", json=body, headers=hdrs, timeout=90)
        if r.status_code != 200:
            logger.warning(f"[OPENAI] HTTP {r.status_code}: {r.text[:150]}")
            return None
        text = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        return text.strip() or None
    except Exception as e:
        logger.warning(f"[OPENAI] call failed: {e}")
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Entity Extraction — Gemini leads (fast), regex fallback
# ──────────────────────────────────────────────────────────────────────────────

EXTRACT_SYSTEM = """You are an expert legal entity extractor for Indian law cases.

Given ANY user input — a legal case description, a casual stock query, a vehicle lookup,
a GST question, or anything else — extract ALL relevant entities.

Return ONLY valid JSON with these fields (use null for missing):
{
  "gstin": "15-char GSTIN or null",
  "pan": "10-char PAN or null",
  "aadhaar": "12-digit Aadhaar or null",
  "vehicle_number": "Indian vehicle reg number or null",
  "dl_number": "Driving licence number or null",
  "ifsc_code": "11-char IFSC or null",
  "pincode": "6-digit pincode or null",
  "cin": "21-char CIN or null",
  "company_name": "NSE/BSE listed company name in lowercase (infosys, tcs, reliance, wipro, etc.) or null",
  "stock_symbol": "NSE symbol like INFY, TCS etc. or null",
  "currency": "Foreign currency code if mentioned (USD, GBP, AED etc.) or null",
  "party_name": "Person/company name as party or null",
  "opponent_name": "Opposing party name or null",
  "case_number": "Case number if any or null",
  "case_type": "Detected case type or null",
  "state_code": "2-letter Indian state code (TS, AP, MH, DL, KA...) or TS by default",
  "location": "City or district name or null",
  "intent": "One of: stock_lookup | gstin_lookup | vehicle_lookup | ifsc_lookup | pincode_lookup | forex_lookup | company_lookup | legal_case | general",
  "primary_query": "What the user is primarily asking for in one sentence"
}

CRITICAL RULES:
- Any mention of a stock/share/NSE/BSE/market/company price → company_name + intent=stock_lookup
- Common companies: infosys, tcs, reliance, wipro, hdfc, icici, sbi, adani, ongc, bajaj, mahindra, maruti, itc, airtel, sun pharma, dr reddy, cipla, titan, nestle, axis bank, kotak, l&t, ultratech, asian paints, hul, zomato, paytm, nykaa
- IFSC pattern: 4 letters + 0 + 6 alphanumeric (SBIN0000001, HDFC0001234)
- Default state_code is TS (Telangana) if not mentioned
- Return ONLY the JSON object, no markdown, no explanation"""


def smart_extract_entities(prompt: str) -> Dict[str, Any]:
    """Extract entities — Gemini leads (fast), regex fallback."""
    safe_prompt = wrap_user_prompt(f"Extract entities from: {prompt}")
    raw = _call_gemini(EXTRACT_SYSTEM, safe_prompt,
                       temperature=0.1, max_tokens=1024)
    if raw:
        try:
            clean = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
            entities = json.loads(clean)
            entities = {k: v for k, v in entities.items() if v is not None and v != ""}
            logger.info(f"[AI_BRAIN] Gemini extracted {len(entities)} entities: {list(entities.keys())}")
            return entities
        except Exception as e:
            logger.warning(f"[AI_BRAIN] Gemini entity JSON parse failed: {e}")

    logger.info("[AI_BRAIN] Using enhanced regex fallback for entity extraction")
    return _regex_extract_entities(prompt)


def _regex_extract_entities(prompt: str) -> Dict[str, Any]:
    """Enhanced regex entity extraction — comprehensive fallback."""
    entities: Dict[str, Any] = {}
    p  = prompt.strip()
    pl = p.lower()

    # Structured identifiers
    m = re.search(r'\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b', p)
    if m: entities["gstin"] = m.group()
    m = re.search(r'\b[A-Z]{5}\d{4}[A-Z]\b', p)
    if m: entities["pan"] = m.group()
    m = re.search(r'\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\b', p)
    if m: entities["vehicle_number"] = m.group()
    m = re.search(r'\b[A-Z]{4}0[A-Z0-9]{6}\b', p)
    if m: entities["ifsc_code"] = m.group()
    m = re.search(r'(?<!\d)([1-9]\d{5})(?!\d)', p)
    if m: entities["pincode"] = m.group(1)
    m = re.search(r'\b[UL]\d{5}[A-Z]{2}\d{4}(?:PLC|PTC|OPC|FLC|GOI|NPL|ULL|ULT)\d{6}\b', p)
    if m: entities["cin"] = m.group()

    # Company / stock intent
    COMPANIES = {
        "infosys": "infosys", "infy": "infosys", "tcs": "tcs", "tata consultancy": "tcs",
        "reliance": "reliance", "ril": "reliance", "wipro": "wipro",
        "hdfc bank": "hdfc", "hdfc": "hdfc", "icici bank": "icici", "icici": "icici",
        "state bank": "sbi", "sbi": "sbi", "bajaj finance": "bajaj", "bajaj": "bajaj",
        "adani": "adani", "ongc": "ongc", "ntpc": "ntpc", "coal india": "coal india",
        "mahindra": "mahindra", "m&m": "mahindra", "maruti": "maruti", "itc": "itc",
        "airtel": "airtel", "bharti airtel": "airtel", "sun pharma": "sun pharma",
        "dr reddy": "dr reddy", "cipla": "cipla", "hero motocorp": "hero motocorp",
        "axis bank": "axis bank", "kotak": "kotak", "l&t": "l&t", "larsen": "l&t",
        "ultratech": "ultratech", "asian paints": "asian paints",
        "hindustan unilever": "hul", "hul": "hul", "nestle": "nestle", "titan": "titan",
        "zomato": "zomato", "swiggy": "swiggy", "paytm": "paytm", "nykaa": "nykaa",
        "tata motors": "tata motors", "tata steel": "tata steel",
        "power grid": "power grid", "bpcl": "bpcl", "ioc": "ioc",
        "indian oil": "ioc", "hpcl": "hpcl",
    }
    for kw, canonical in COMPANIES.items():
        if kw in pl:
            entities["company_name"] = canonical
            break
    if "company_name" not in entities:
        m = re.search(
            r'(?:stock|share|price|quote|nse|bse|search|lookup|find|check|'
            r'tell me about|info(?:rmation)?\s+(?:of|about|on))\s+(?:of\s+)?'
            r'([A-Za-z][A-Za-z\s&\.]{2,30}?)(?:\s+(?:stock|share|price|ltd|limited|pvt|corp))?'
            r'(?:\s|$|\.|\?|,)', pl)
        if m:
            candidate = m.group(1).strip()
            if len(candidate) >= 2 and candidate not in ("the", "an", "a", "my", "is", "are"):
                entities["company_name"] = candidate

    STOCK_SIGNALS = ["stock", "share", "nse", "bse", "market", "price", "listed", "dividend",
                     "ipo", "trading", "investor", "securities", "equity", "portfolio", "sensex", "nifty"]
    if "company_name" in entities or any(s in pl for s in STOCK_SIGNALS):
        entities["intent"] = "stock_lookup"
    elif entities.get("gstin"):    entities["intent"] = "gstin_lookup"
    elif entities.get("vehicle_number"): entities["intent"] = "vehicle_lookup"
    elif entities.get("ifsc_code"):      entities["intent"] = "ifsc_lookup"
    elif entities.get("pincode"):        entities["intent"] = "pincode_lookup"
    else:                                entities["intent"] = "legal_case"

    CASE_TYPES = {
        "eviction": "Rent Eviction", "rent": "Rent Eviction", "gst": "GST Dispute",
        "cheque": "Cheque Bounce", "divorce": "Matrimonial", "property": "Property Dispute",
        "motor": "Motor Accident", "accident": "Motor Accident", "criminal": "Criminal",
        "writ": "Writ Petition", "securities": "Securities Fraud", "insider": "Insider Trading",
        "npa": "NPA / DRT", "drt": "NPA / DRT", "insolvency": "Insolvency",
        "bank fraud": "Bank Fraud", "cheating": "Cheating / Fraud",
    }
    for kw, ct in CASE_TYPES.items():
        if kw in pl: entities["case_type"] = ct; break

    for pat in [
        r'client\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'(?:Mr\.|Mrs\.|Dr\.|Adv\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
    ]:
        m = re.search(pat, p)
        if m: entities["party_name"] = m.group(1); break

    STATE_MAP = {
        "hyderabad": "TS", "telangana": "TS", "secunderabad": "TS", "warangal": "TS",
        "mumbai": "MH", "pune": "MH", "nagpur": "MH", "delhi": "DL", "new delhi": "DL",
        "bangalore": "KA", "bengaluru": "KA", "chennai": "TN", "kolkata": "WB",
        "ahmedabad": "GJ", "vizag": "AP", "visakhapatnam": "AP", "vijayawada": "AP",
        "andhra": "AP", "amaravati": "AP",
    }
    for city, code in STATE_MAP.items():
        if city in pl:
            entities["state_code"] = code
            entities["location"] = city.title()
            break
    if "state_code" not in entities:
        entities["state_code"] = "TS"

    return entities


# ──────────────────────────────────────────────────────────────────────────────
# Strategy Synthesis — Claude leads, GPT-5 → Gemini → smart template fallback
# ──────────────────────────────────────────────────────────────────────────────

LEGAL_OUTPUT_FORMAT = """
=== CASE ANALYSIS ===

1. FACTS SUMMARY
----------------
[Brief, neutral summary of case facts. 3-5 sentences. Only facts from the user's input.]

2. IDENTIFIED ISSUES
--------------------
- Issue 1: [concise legal issue]
- Issue 2: [concise legal issue]

3. APPLICABLE LAWS
------------------
- [Act Name, Section X] — [one-line relevance to this case]
- [Act Name, Section Y] — [one-line relevance]
[Every law must have a verifiable Act name and section number.]

4. GOVERNMENT DATA FINDINGS
---------------------------
[Only if API chains returned data. List verified facts per chain, with source.]
[If no data returned, write: "No government data available for this case."]

5. RECOMMENDED STRATEGY
-----------------------
Immediate (within 7 days):
- Action 1: [who, what, under which law]
- Action 2: [who, what, under which law]

Medium-term (within 30 days):
- Action 1
- Action 2

6. DOCUMENT CHECKLIST
---------------------
- [ ] Document 1 (purpose)
- [ ] Document 2 (purpose)

7. DISCLAIMERS & CAVEATS
--------------------------
[Specific caveats: what this analysis cannot determine without further evidence.]
[Standard legal disclaimer.]
"""

STRATEGY_SYSTEM = """You are a senior Indian advocate drafting a case analysis for a fellow advocate to use in court or tribunal proceedings in Telangana or Andhra Pradesh.

SOURCES YOU MAY USE:
- The user's original query / case facts
- Real data retrieved from government APIs (GSTN, VAHAN, NSE, RBI IFSC, India Post, etc.)
- Established Indian statutes and reported case law

OUTPUT RULES — violation of any rule is a critical error:
1. Use ONLY the exact section headings in LEGAL_OUTPUT_FORMAT. No extra sections.
2. Every fact in "FACTS SUMMARY" must be traceable to the user's input or an API result.
3. Every law in "APPLICABLE LAWS" must state the Act name AND section number.
4. "GOVERNMENT DATA FINDINGS" must name the exact source chain (e.g., "GSTIN — GSTN Portal").
5. "RECOMMENDED STRATEGY" must name the specific Act/Section that authorises each action.
6. Never invent facts, parties, dates, amounts, or legal provisions not present in the input.
7. Never use speculative language ("may", "might", "could", "possibly"). Use "requires", "mandates", "prohibits".
8. Never include generic boilerplate examples, sample clauses, or template text.
9. Never include marketing language, emojis, ASCII art, or self-referential AI commentary.
10. Maximum length: 800 words. Be concise. A busy advocate must read this in under 2 minutes.
11. If a section has no content, write "Not applicable" — do not omit the heading."""


def smart_legal_strategy(
    prompt: str,
    entities: Dict[str, Any],
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    """
    Generate intelligent, data-driven legal strategy.
    Cascade: Claude Sonnet → GPT-5-mini → Gemini → smart template
    """
    _init_providers()
    active = get_active_providers()

    intent    = entities.get("intent", "legal_case")
    company   = entities.get("company_name", "")
    case_type = entities.get("case_type", "General")
    location  = entities.get("location", "Hyderabad")

    # Build compact data summary (only non-skipped results)
    data_summary = {
        chain: result for chain, result in api_results.items()
        if isinstance(result, dict) and result.get("status") not in ("skipped", None)
    }

    safe_context = wrap_user_prompt(f"""User Query / Case Facts:
{prompt}

Detected Intent: {intent}
Company/Entity: {company or 'Not specified'}
Case Type: {case_type}
Location: {location}
Case ID: {case_id}
Active AI Providers: {', '.join(active)}

{LEGAL_OUTPUT_FORMAT}

Real Government API Data Retrieved:
{json.dumps(data_summary, indent=2, default=str)[:7000]}
""")

    # 1️⃣ Try Claude Sonnet 4-6 — best for structured legal documents
    if "claude" in active:
        logger.info(f"[AI_BRAIN] Strategy via Claude Sonnet 4-6 (case {case_id})")
        result = _call_claude(STRATEGY_SYSTEM, safe_context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return safe_ai_output(result, api_results)

    # 2️⃣ Try OpenAI GPT-5-mini
    if "openai" in active:
        logger.info(f"[AI_BRAIN] Strategy via GPT-5-mini (case {case_id})")
        result = _call_openai(STRATEGY_SYSTEM, safe_context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return safe_ai_output(result, api_results)

    # 3️⃣ Try Gemini 2.5 Flash
    if "gemini" in active:
        logger.info(f"[AI_BRAIN] Strategy via Gemini 2.5 Flash (case {case_id})")
        result = _call_gemini(STRATEGY_SYSTEM, safe_context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return safe_ai_output(result, api_results)

    # 4️⃣ Smart data-driven template — never generic
    logger.info(f"[AI_BRAIN] All AI providers failed — using smart data template (case {case_id})")
    fallback = _smart_fallback_strategy(prompt, entities, api_results, case_id)
    return safe_ai_output(fallback, None)


# ──────────────────────────────────────────────────────────────────────────────
# Smart data-driven fallback — reads real chain results, never generic text
# ──────────────────────────────────────────────────────────────────────────────

def _smart_fallback_strategy(
    prompt: str,
    entities: Dict[str, Any],
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    intent    = entities.get("intent", "legal_case")
    company   = entities.get("company_name", "")
    location  = entities.get("location", "Hyderabad")
    case_type = entities.get("case_type", "General Legal Matter")
    gov_data  = []

    # Stock / NSE
    nse = api_results.get("NSE_INDIA", {})
    if nse.get("status") == "success" and company:
        q     = (nse.get("results", {}).get("live_quote") or {})
        price = q.get("last_price", "—")
        chg   = q.get("pct_change", "—")
        cname = q.get("company", company.title())
        gov_data.append(
            f"NSE India (live): {cname} @ Rs.{price} ({chg}% change)"
        )

    # IFSC / Bank
    ifsc = api_results.get("IFSC", {})
    if ifsc.get("status") == "success":
        gov_data.append(
            f"RBI IFSC Registry: {ifsc.get('bank_name')}, {ifsc.get('branch')}, "
            f"MICR {ifsc.get('micr_code', '—')}"
        )

    # Pincode
    pin = api_results.get("PINCODE", {})
    if pin.get("status") == "success":
        gov_data.append(
            f"India Post: Pincode {pin.get('pincode')} → {pin.get('district')}, {pin.get('state')}"
        )

    # GSTIN
    gstin = api_results.get("GSTIN", {})
    if gstin.get("status") == "success":
        gov_data.append(
            f"GSTN Portal: {gstin.get('legal_name')} — Status: {gstin.get('registration_status')}"
        )

    # eCourts
    ecourts = api_results.get("ECOURTS", {})
    if ecourts.get("status") == "success":
        gov_data.append(f"eCourts India: {ecourts.get('cnr_number', 'CNR lookup')} case data retrieved")

    # VAHAN
    vahan = api_results.get("VAHAN", {})
    if vahan.get("status") == "success":
        gov_data.append(
            f"VAHAN: Vehicle {vahan.get('registration_number', '—')} — "
            f"RC status: {vahan.get('rc_status', '—')}"
        )

    # MeeSeva
    mee = api_results.get("MEE_SEVA", {})
    if mee.get("status") == "success":
        gov_data.append(f"MeeSeva TG: {mee.get('service_name', 'service')} application {mee.get('application_id', '—')}")

    # Transport
    ts = api_results.get("TRANSPORT_TS", {})
    if ts.get("status") == "success":
        gov_data.append(f"Transport TS: Permit {ts.get('permit_number', '—')} valid until {ts.get('validity', '—')}")

    active_chains = [k for k, v in api_results.items()
                     if isinstance(v, dict) and v.get("status") not in ("skipped", "no_api_key", "error")]

    # Build structured output matching LEGAL_OUTPUT_FORMAT
    lines = [
        "=== CASE ANALYSIS ===",
        "",
        "1. FACTS SUMMARY",
        "----------------",
        prompt[:300] if len(prompt) > 20 else "No case facts provided.",
        "",
        "2. IDENTIFIED ISSUES",
        "--------------------",
    ]

    # Add issues based on intent
    if "stock" in intent or "nse" in intent:
        lines.append("- Securities law compliance and valuation of listed assets")
        lines.append("- Potential insider trading or market manipulation under SEBI Act 1992")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("- Dishonour of cheque and recovery under Negotiable Instruments Act 1881")
        lines.append("- Territorial jurisdiction of the drawee bank")
    elif "gstin" in intent or "gst" in intent:
        lines.append("- Tax compliance and registration status under CGST Act 2017")
        lines.append("- Attachment risk under S.83 if registration is inactive")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("- Motor vehicle accident liability under Motor Vehicles Act 1988")
        lines.append("- Insurance claim validity based on RC and permit status")
    elif "pincode" in intent or "property" in intent:
        lines.append("- Territorial jurisdiction for civil proceedings (CPC S.20)")
        lines.append("- Venue for sub-registrar verification and summons service")
    else:
        lines.append("- General legal matter requiring further factual clarification")
        lines.append("- Jurisdiction and applicable substantive law to be determined")

    lines.extend([
        "",
        "3. APPLICABLE LAWS",
        "------------------",
    ])

    if "stock" in intent or "nse" in intent:
        lines.append("- SEBI Act 1992, S.11, S.11B, S.12A — market manipulation and insider trading")
        lines.append("- SEBI (Prohibition of Insider Trading) Regulations 2015, Reg. 4 — UPSI disclosure")
        lines.append("- Companies Act 2013, S.447 — fraud in relation to securities")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("- Negotiable Instruments Act 1881, S.138 — cheque dishonour and penalty")
        lines.append("- Negotiable Instruments Act 1881, S.142 — jurisdiction for complaint")
        lines.append("- RBI Act 1934 — banking regulation and customer grievance")
    elif "gstin" in intent or "gst" in intent:
        lines.append("- CGST Act 2017, S.83 — provisional attachment in pending proceedings")
        lines.append("- CGST Act 2017, S.132 — tax evasion and penalties")
        lines.append("- CGST Act 2017, S.29 — cancellation of registration")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("- Motor Vehicles Act 1988, S.146 — compulsory third-party insurance")
        lines.append("- Motor Vehicles Act 1988, S.166 — claim for compensation")
        lines.append("- CPC 1908, O.37 R.1 — summary suit for recovery")
    elif "pincode" in intent or "property" in intent:
        lines.append("- CPC 1908, S.20 — place of suing (territorial jurisdiction)")
        lines.append("- CPC 1908, O.V — service of summons")
        lines.append("- Registration Act 1908, S.17 — documents requiring registration")
    else:
        lines.append("- To be determined upon review of complete case facts")

    lines.extend([
        "",
        "4. GOVERNMENT DATA FINDINGS",
        "---------------------------",
    ])
    if gov_data:
        for item in gov_data:
            lines.append(f"- {item}")
    else:
        lines.append("No government data available for this case.")

    lines.extend([
        "",
        "5. RECOMMENDED STRATEGY",
        "-----------------------",
        "Immediate (within 7 days):",
    ])

    if "stock" in intent or "nse" in intent:
        lines.append("- Obtain certified NSE/BSE trade reports for the disputed period")
        lines.append("- File complaint on SEBI SCORES portal (scores.sebi.gov.in) with trade history")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("- Send statutory demand notice under NI Act S.138 within 30 days of dishonour")
        lines.append("- File complaint in court of payee's bank jurisdiction (NI Act S.142)")
    elif "gstin" in intent or "gst" in intent:
        lines.append("- Verify registration status on GSTN portal and preserve screenshots")
        lines.append("- File DRC-01 if tax demand arises; seek stay under CGST Act S.83 if attachment threatened")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("- File insurance claim with RC, permit, and FIR copies within 30 days")
        lines.append("- Initiate MACT proceedings under Motor Vehicles Act S.166 for compensation")
    elif "pincode" in intent or "property" in intent:
        lines.append("- Verify territorial jurisdiction at district court (CPC S.20)")
        lines.append("- Engage local process server for summons via registered post (CPC O.V)")
    else:
        lines.append("- Gather complete case facts and supporting documents")
        lines.append("- Identify all parties, causes of action, and desired relief")

    lines.extend([
        "",
        "Medium-term (within 30 days):",
        "- Engage local counsel in the identified jurisdiction",
        "- Prepare draft pleadings and evidence bundle",
        "",
        "6. DOCUMENT CHECKLIST",
        "---------------------",
    ])

    if "stock" in intent or "nse" in intent:
        lines.append("- [ ] Certified NSE/BSE trade reports")
        lines.append("- [ ] SEBI SCORES complaint acknowledgement")
        lines.append("- [ ] Board resolutions and insider trading policy (if corporate)")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("- [ ] Dishonoured cheque and bank memo")
        lines.append("- [ ] Statutory demand notice with proof of service")
        lines.append("- [ ] IFSC verification printout from RBI registry")
    elif "gstin" in intent or "gst" in intent:
        lines.append("- [ ] GST registration certificate and ARN")
        lines.append("- [ ] Return filing history (GSTR-1, GSTR-3B)")
        lines.append("- [ ] Demand-cum-show-cause notice (if any)")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("- [ ] FIR copy and police investigation report")
        lines.append("- [ ] RC book and valid insurance policy")
        lines.append("- [ ] Medical records and disability certificate (if injury)")
    elif "pincode" in intent or "property" in intent:
        lines.append("- [ ] Sale deed / title documents")
        lines.append("- [ ] Encumbrance certificate (EC) for 30 years")
        lines.append("- [ ] Address proof and voter ID for summons verification")
    else:
        lines.append("- [ ] All relevant contracts, correspondence, and receipts")
        lines.append("- [ ] Identity and address proof of all parties")
        lines.append("- [ ] Timeline of events with dates and witnesses")

    lines.extend([
        "",
        "7. DISCLAIMERS & CAVEATS",
        "--------------------------",
        "- This analysis is based on the facts and government data available at the time of generation.",
        "- Further investigation may reveal additional facts that alter the legal position.",
        "- Jurisdictional nuances (High Court, District Court, Tribunal) require case-specific advice.",
        "- Statutory references are current as of the date of this report; amendments may apply.",
        "",
        "---",
        "Generated by LitigaForge AI | Case ID: {case_id} | Chains: {chains}",
        "This is legal information, not legal advice. Consult a qualified advocate before taking action.",
    ])

    return "\n".join(lines).format(case_id=case_id, chains=", ".join(active_chains) or "General")
