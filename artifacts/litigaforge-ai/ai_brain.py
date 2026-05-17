"""
LitigaForge AI Brain — Multi-model intelligence layer.

Three AI providers, each doing what it does best:
  - Gemini 2.5 Flash  — fast entity extraction & intent detection
  - Claude Sonnet 4-6 — deep legal strategy synthesis (best structured writing)
  - GPT-4o            — fallback strategy when Claude is busy

Cascade for entity extraction : Gemini -> regex fallback
Cascade for strategy synthesis: Claude -> GPT-4o -> Gemini -> smart data template

TWO deployment modes (auto-detected):

  1. Replit (free, no keys needed) — uses Replit AI Integration proxy:
       AI_INTEGRATIONS_ANTHROPIC_BASE_URL / AI_INTEGRATIONS_ANTHROPIC_API_KEY
       AI_INTEGRATIONS_GEMINI_BASE_URL    / AI_INTEGRATIONS_GEMINI_API_KEY
       AI_INTEGRATIONS_OPENAI_BASE_URL    / AI_INTEGRATIONS_OPENAI_API_KEY

  2. AWS / Self-hosted — uses direct vendor API keys in .env:
       ANTHROPIC_API_KEY   (https://console.anthropic.com/)
       OPENAI_API_KEY      (https://platform.openai.com/api-keys)
       GOOGLE_API_KEY      (https://aistudio.google.com/app/apikey)
"""
import os
import re
import json
import logging
from typing import Dict, Any, Optional

import requests as _req

logger = logging.getLogger("litigaforge.ai_brain")

# ── Provider registry — lazy-initialised on first call ────────────────────────
_providers: Dict[str, dict] = {}


def _resolve_provider(
    replit_base_env: str,
    replit_key_env: str,
    direct_key_env: str,
    direct_base_url: str,
) -> tuple[str, str]:
    """
    Return (base_url, api_key) for a provider.
    Priority: Replit AI Integrations proxy → direct vendor API key.
    """
    replit_base = os.getenv(replit_base_env, "").rstrip("/")
    replit_key  = os.getenv(replit_key_env, "")
    if replit_base:
        return replit_base, replit_key

    direct_key = os.getenv(direct_key_env, "")
    if direct_key:
        return direct_base_url.rstrip("/"), direct_key

    return "", ""


def _init_providers():
    """
    Probe all three AI providers once and cache readiness.

    Supports two modes (auto-detected):
      - Replit: uses AI_INTEGRATIONS_* proxy env vars (free, no keys needed)
      - AWS/self-hosted: uses ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
    """
    global _providers
    if _providers:
        return

    # ── Gemini 2.5 Flash ──────────────────────────────────────────────────────
    gemini_base, gemini_key = _resolve_provider(
        "AI_INTEGRATIONS_GEMINI_BASE_URL",
        "AI_INTEGRATIONS_GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "https://generativelanguage.googleapis.com/v1beta",
    )
    gemini_ready = False
    if gemini_base:
        try:
            url  = f"{gemini_base}/models/gemini-2.5-flash:generateContent"
            hdrs = {"x-goog-api-key": gemini_key, "Content-Type": "application/json"}
            body = {"contents": [{"role": "user", "parts": [{"text": "ping"}]}],
                    "generationConfig": {"maxOutputTokens": 5}}
            r = _req.post(url, json=body, headers=hdrs, timeout=10)
            gemini_ready = r.status_code == 200
        except Exception:
            pass
    _providers["gemini"] = {"base": gemini_base, "key": gemini_key, "ready": gemini_ready}
    mode = "Replit proxy" if os.getenv("AI_INTEGRATIONS_GEMINI_BASE_URL") else "direct API key"
    logger.info(f"[AI_BRAIN] Gemini 2.5 Flash ({mode}): {'READY' if gemini_ready else 'unavailable'}")

    # ── Claude Sonnet 4-6 ─────────────────────────────────────────────────────
    claude_base, claude_key = _resolve_provider(
        "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
        "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
        "ANTHROPIC_API_KEY",
        "https://api.anthropic.com/v1",
    )
    claude_ready = False
    if claude_base:
        try:
            hdrs = {"x-api-key": claude_key, "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"}
            body = {"model": "claude-sonnet-4-6", "max_tokens": 10,
                    "messages": [{"role": "user", "content": "ping"}]}
            r = _req.post(f"{claude_base}/messages", json=body, headers=hdrs, timeout=10)
            claude_ready = r.status_code == 200
        except Exception:
            pass
    _providers["claude"] = {"base": claude_base, "key": claude_key, "ready": claude_ready}
    mode = "Replit proxy" if os.getenv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL") else "direct API key"
    logger.info(f"[AI_BRAIN] Claude Sonnet 4-6 ({mode}): {'READY' if claude_ready else 'unavailable'}")

    # ── OpenAI GPT-4o ─────────────────────────────────────────────────────────
    openai_base, openai_key = _resolve_provider(
        "AI_INTEGRATIONS_OPENAI_BASE_URL",
        "AI_INTEGRATIONS_OPENAI_API_KEY",
        "OPENAI_API_KEY",
        "https://api.openai.com/v1",
    )
    openai_ready = False
    if openai_base:
        try:
            hdrs = {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
            body = {"model": "gpt-4o",
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_tokens": 5}
            r = _req.post(f"{openai_base}/chat/completions", json=body, headers=hdrs, timeout=10)
            openai_ready = r.status_code == 200
        except Exception:
            pass
    _providers["openai"] = {"base": openai_base, "key": openai_key, "ready": openai_ready}
    mode = "Replit proxy" if os.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL") else "direct API key"
    logger.info(f"[AI_BRAIN] OpenAI GPT-4o ({mode}): {'READY' if openai_ready else 'unavailable'}")

    ready_count = sum(1 for p in _providers.values() if p["ready"])
    replit_mode = any(os.getenv(f"AI_INTEGRATIONS_{p}_BASE_URL") for p in ["ANTHROPIC", "GEMINI", "OPENAI"])
    deploy_mode = "Replit AI Integrations" if replit_mode else "Direct API Keys (AWS/self-hosted)"
    logger.info(f"[AI_BRAIN] {ready_count}/3 providers active | Mode: {deploy_mode}")


def get_active_providers() -> list:
    _init_providers()
    return [name for name, p in _providers.items() if p["ready"]]


# ── Low-level callers ─────────────────────────────────────────────────────────

def _call_gemini(system: str, user: str, temperature: float = 0.2,
                 max_tokens: int = 8192) -> Optional[str]:
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
        r = _req.post(url, json=body, headers=hdrs, timeout=60)
        if r.status_code != 200:
            logger.warning(f"[GEMINI] HTTP {r.status_code}: {r.text[:200]}")
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
                 max_tokens: int = 8000) -> Optional[str]:
    _init_providers()
    p = _providers.get("claude", {})
    if not p.get("ready"):
        return None
    hdrs = {"x-api-key": p["key"], "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"}
    body = {"model": "claude-sonnet-4-6", "max_tokens": max_tokens,
            "system": system, "messages": [{"role": "user", "content": user}]}
    try:
        r = _req.post(f"{p['base']}/messages", json=body, headers=hdrs, timeout=90)
        if r.status_code != 200:
            logger.warning(f"[CLAUDE] HTTP {r.status_code}: {r.text[:200]}")
            return None
        content = r.json().get("content", [])
        text = " ".join(c.get("text", "") for c in content if c.get("type") == "text")
        return text.strip() or None
    except Exception as e:
        logger.warning(f"[CLAUDE] call failed: {e}")
        return None


def _call_openai(system: str, user: str, temperature: float = 0.3,
                 max_tokens: int = 8000) -> Optional[str]:
    _init_providers()
    p = _providers.get("openai", {})
    if not p.get("ready"):
        return None
    hdrs = {"Authorization": f"Bearer {p['key']}", "Content-Type": "application/json"}
    body = {"model": "gpt-4o",
            "messages": [{"role": "system", "content": system},
                          {"role": "user", "content": user}],
            "max_tokens": max_tokens, "temperature": temperature}
    try:
        r = _req.post(f"{p['base']}/chat/completions", json=body, headers=hdrs, timeout=90)
        if r.status_code != 200:
            logger.warning(f"[OPENAI] HTTP {r.status_code}: {r.text[:200]}")
            return None
        text = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        return text.strip() or None
    except Exception as e:
        logger.warning(f"[OPENAI] call failed: {e}")
        return None


# ── Entity Extraction ─────────────────────────────────────────────────────────

EXTRACT_SYSTEM = """You are an expert legal entity extractor for Indian law cases.

Extract ALL relevant entities from the user input and return ONLY valid JSON:
{
  "gstin": "15-char GSTIN or null",
  "pan": "10-char PAN or null",
  "aadhaar": "12-digit Aadhaar or null",
  "vehicle_number": "Indian vehicle reg number or null",
  "dl_number": "Driving licence number or null",
  "ifsc_code": "11-char IFSC or null",
  "pincode": "6-digit pincode or null",
  "cin": "21-char CIN or null",
  "company_name": "NSE/BSE listed company name in lowercase or null",
  "stock_symbol": "NSE symbol like INFY, TCS etc. or null",
  "currency": "Foreign currency code (USD, GBP, AED etc.) or null",
  "party_name": "Person/company name as party or null",
  "opponent_name": "Opposing party name or null",
  "case_number": "Case number if any or null",
  "case_type": "Detected case type or null",
  "state_code": "2-letter Indian state code (TS, AP, MH, DL, KA...) or TS by default",
  "location": "City or district name or null",
  "intent": "stock_lookup | gstin_lookup | vehicle_lookup | ifsc_lookup | pincode_lookup | forex_lookup | company_lookup | legal_case | general",
  "primary_query": "What the user is primarily asking for in one sentence"
}

RULES: Any mention of stock/share/NSE/BSE/market -> intent=stock_lookup + company_name.
Default state_code is TS. Return ONLY JSON, no markdown."""


def smart_extract_entities(prompt: str) -> Dict[str, Any]:
    """Extract entities — Gemini 2.5 Flash leads, regex fallback."""
    raw = _call_gemini(EXTRACT_SYSTEM, f"Extract entities from: {prompt}",
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

    logger.info("[AI_BRAIN] Using regex fallback for entity extraction")
    return _regex_extract_entities(prompt)


def _regex_extract_entities(prompt: str) -> Dict[str, Any]:
    entities: Dict[str, Any] = {}
    p  = prompt.strip()
    pl = p.lower()

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

    COMPANIES = {
        "infosys": "infosys", "tcs": "tcs", "reliance": "reliance",
        "wipro": "wipro", "hdfc": "hdfc", "icici": "icici", "sbi": "sbi",
        "bajaj": "bajaj", "adani": "adani", "ongc": "ongc", "mahindra": "mahindra",
        "maruti": "maruti", "itc": "itc", "airtel": "airtel",
        "sun pharma": "sun pharma", "dr reddy": "dr reddy", "cipla": "cipla",
        "titan": "titan", "zomato": "zomato", "paytm": "paytm",
        "axis bank": "axis bank", "kotak": "kotak", "ntpc": "ntpc",
        "power grid": "power grid", "bpcl": "bpcl", "hpcl": "hpcl",
    }
    for kw, canonical in COMPANIES.items():
        if kw in pl:
            entities["company_name"] = canonical
            break

    STOCK_SIGNALS = ["stock", "share", "nse", "bse", "market", "price", "listed",
                     "dividend", "ipo", "trading", "equity", "sensex", "nifty"]
    if "company_name" in entities or any(s in pl for s in STOCK_SIGNALS):
        entities["intent"] = "stock_lookup"
    elif entities.get("gstin"):          entities["intent"] = "gstin_lookup"
    elif entities.get("vehicle_number"): entities["intent"] = "vehicle_lookup"
    elif entities.get("ifsc_code"):      entities["intent"] = "ifsc_lookup"
    elif entities.get("pincode"):        entities["intent"] = "pincode_lookup"
    else:                                entities["intent"] = "legal_case"

    CASE_TYPES = {
        "eviction": "Rent Eviction", "rent": "Rent Eviction", "gst": "GST Dispute",
        "cheque": "Cheque Bounce", "divorce": "Matrimonial", "property": "Property Dispute",
        "motor": "Motor Accident", "accident": "Motor Accident", "criminal": "Criminal",
        "writ": "Writ Petition", "npa": "NPA / DRT", "drt": "NPA / DRT",
        "insolvency": "Insolvency", "bank fraud": "Bank Fraud",
    }
    for kw, ct in CASE_TYPES.items():
        if kw in pl:
            entities["case_type"] = ct
            break

    STATE_MAP = {
        "hyderabad": "TS", "telangana": "TS", "warangal": "TS", "secunderabad": "TS",
        "mumbai": "MH", "pune": "MH", "delhi": "DL", "new delhi": "DL",
        "bangalore": "KA", "bengaluru": "KA", "chennai": "TN",
        "kolkata": "WB", "ahmedabad": "GJ",
        "vizag": "AP", "visakhapatnam": "AP", "vijayawada": "AP", "andhra": "AP",
    }
    for city, code in STATE_MAP.items():
        if city in pl:
            entities["state_code"] = code
            entities["location"] = city.title()
            break
    if "state_code" not in entities:
        entities["state_code"] = "TS"

    return entities


# ── Strategy Synthesis ────────────────────────────────────────────────────────

STRATEGY_SYSTEM = """You are a senior Indian advocate with 20 years of experience in Telangana and Andhra Pradesh High Courts, Supreme Court, and SEBI/NCLT/DRT tribunals.

Write a sharp, actionable legal strategy STRICTLY based on the actual government API data provided.

MANDATORY RULES:
- NEVER use generic template text. Every section must reference actual data values.
- If stock/NSE data: lead with live price, 52-week range, financial health implications.
- If IFSC/bank data: use actual branch name, address, MICR code in NI Act S.138 analysis.
- If GSTIN data: use actual registration status, return filing record in CGST Act analysis.
- If pincode data: use actual district/state for jurisdiction (CPC S.20).
- If vehicle data: use actual RC details for motor accident / insurance analysis.
- Quote actual Indian laws with section numbers in every recommendation.

Structure with EXACTLY these headings:
## Summary
## Key Findings from Government Data
## Legal Analysis
## Recommended Actions (within 7 days)
## Document Checklist"""


def smart_legal_strategy(
    prompt: str,
    entities: Dict[str, Any],
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    """
    Generate data-driven legal strategy.
    Cascade: Claude Sonnet 4-6 -> GPT-4o -> Gemini 2.5 Flash -> smart template
    All providers are free via Replit AI Integrations — no user API keys needed.
    """
    _init_providers()
    active = get_active_providers()

    data_summary = {
        chain: result for chain, result in api_results.items()
        if isinstance(result, dict) and result.get("status") not in ("skipped", None)
    }

    context = (
        f"User Query / Case Facts:\n{prompt}\n\n"
        f"Detected Intent: {entities.get('intent', 'legal_case')}\n"
        f"Company/Entity: {entities.get('company_name', 'Not specified')}\n"
        f"Case Type: {entities.get('case_type', 'General')}\n"
        f"Location: {entities.get('location', 'Hyderabad')}\n"
        f"Case ID: {case_id}\n"
        f"Active AI Providers: {', '.join(active) if active else 'None (template fallback)'}\n\n"
        f"Real Government API Data Retrieved:\n"
        f"{json.dumps(data_summary, indent=2, default=str)[:7000]}"
    )

    # 1. Claude Sonnet 4-6
    if "claude" in active:
        logger.info(f"[AI_BRAIN] Strategy via Claude Sonnet 4-6 (case {case_id})")
        result = _call_claude(STRATEGY_SYSTEM, context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return (f"LITIGAFORGE AI — CASE {case_id} "
                    f"[Claude Sonnet 4-6 | Replit AI Integrations]\n{'='*60}\n\n{result}")

    # 2. OpenAI GPT-4o
    if "openai" in active:
        logger.info(f"[AI_BRAIN] Strategy via GPT-4o (case {case_id})")
        result = _call_openai(STRATEGY_SYSTEM, context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return (f"LITIGAFORGE AI — CASE {case_id} "
                    f"[GPT-4o | Replit AI Integrations]\n{'='*60}\n\n{result}")

    # 3. Gemini 2.5 Flash
    if "gemini" in active:
        logger.info(f"[AI_BRAIN] Strategy via Gemini 2.5 Flash (case {case_id})")
        result = _call_gemini(STRATEGY_SYSTEM, context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return (f"LITIGAFORGE AI — CASE {case_id} "
                    f"[Gemini 2.5 Flash | Replit AI Integrations]\n{'='*60}\n\n{result}")

    # 4. Smart data-driven template fallback
    logger.info(f"[AI_BRAIN] All AI providers unavailable — smart template (case {case_id})")
    return _smart_fallback_strategy(prompt, entities, api_results, case_id)


def _smart_fallback_strategy(
    prompt: str,
    entities: Dict[str, Any],
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    location  = entities.get("location", "Hyderabad")
    case_type = entities.get("case_type", "General Legal Matter")
    company   = entities.get("company_name", "")
    sections  = []

    nse = api_results.get("NSE_INDIA", {})
    if nse.get("status") == "success" and company:
        q     = (nse.get("results", {}).get("live_quote") or {})
        price = q.get("last_price", "N/A")
        chg   = q.get("pct_change", "N/A")
        w52h  = q.get("week_52_high", "N/A")
        w52l  = q.get("week_52_low", "N/A")
        cname = q.get("company", company.title())
        sections.append(
            f"## Key Findings from Government Data\n\n"
            f"**NSE Live — {cname}**: Rs.{price} ({chg}%) | 52W: Rs.{w52l}–{w52h}\n\n"
            f"## Legal Analysis\n\n"
            f"- Asset Valuation (Family Courts Act) — share price on petition date\n"
            f"- Insider Trading — SEBI PIT Regulations 2015, Reg.4\n"
            f"- NPA/DRT Attachment — market cap for proportionality\n\n"
            f"## Recommended Actions (within 7 days)\n"
            f"1. File at SEBI SCORES portal (scores.sebi.gov.in)\n"
            f"2. Cite SEBI Act 1992 S.11, S.11B for market manipulation\n"
            f"3. Obtain certified NSE/BSE trade reports for evidence"
        )

    ifsc = api_results.get("IFSC", {})
    if ifsc.get("status") == "success":
        sections.append(
            f"## Key Findings from Government Data\n\n"
            f"**Bank Branch (RBI)**: {ifsc.get('bank_name')} — {ifsc.get('branch')}, "
            f"{ifsc.get('city')}, {ifsc.get('state')} | MICR: {ifsc.get('micr_code', 'N/A')}\n\n"
            f"## Legal Analysis — NI Act S.138\n\n"
            f"- Drawee bank confirmed — essential for prosecution\n"
            f"- File complaint in court of payee's bank jurisdiction (NI Act S.142)\n\n"
            f"## Recommended Actions (within 7 days)\n"
            f"1. Send statutory demand notice within 30 days of dishonour\n"
            f"2. File complaint within 30 days of expiry of 15-day notice period"
        )

    pin = api_results.get("PINCODE", {})
    if pin.get("status") == "success":
        sections.append(
            f"## Key Findings from Government Data\n\n"
            f"**Address (India Post)**: {pin.get('pincode')} — {pin.get('district')}, "
            f"{pin.get('state')}\n\n"
            f"## Legal Analysis\n\n"
            f"- Jurisdiction: Courts in {pin.get('district')}, {pin.get('state')} (CPC S.20)"
        )

    gstin = api_results.get("GSTIN", {})
    if gstin.get("status") == "success":
        status = gstin.get("registration_status", "")
        sections.append(
            f"## Key Findings from Government Data\n\n"
            f"**GSTIN (GSTN)**: {gstin.get('legal_name')} | Status: {status} | "
            f"Type: {gstin.get('taxpayer_type')}\n\n"
            f"## Legal Analysis — CGST Act 2017\n\n"
            f"- {'Active — use for compliance verification' if 'active' in status.lower() else 'Inactive — grounds for attachment under CGST Act S.83'}"
        )

    active_chains = [
        k for k, v in api_results.items()
        if isinstance(v, dict) and v.get("status") not in ("skipped", "no_api_key", "error")
    ]

    header = (
        f"LITIGAFORGE AI — CASE {case_id} [Smart Template Fallback]\n"
        f"{'='*60}\n\n"
        f"## Summary\n"
        f"**Query**: {prompt[:200]}\n"
        f"**APIs Queried**: {', '.join(active_chains) or 'None'}\n"
        f"**Location**: {location} | **Type**: {case_type}\n\n"
    )

    if sections:
        return header + "\n\n".join(sections)

    return header + (
        "No identifiers detected. Add GSTIN, vehicle number, IFSC, company name, or pincode.\n\n"
        "Examples:\n"
        "- 'search Infosys stock' -> live NSE + legal strategy\n"
        "- 'Cheque bounce IFSC SBIN0020149' -> bank verification + NI Act S.138\n"
        "- 'GSTIN 36AAAAA0000A1ZA fraud' -> live GSTIN + CGST Act strategy"
    )
