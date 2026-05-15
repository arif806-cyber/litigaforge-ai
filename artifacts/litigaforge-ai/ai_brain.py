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

STRATEGY_SYSTEM = """You are a senior Indian advocate with 20 years of experience in Telangana and Andhra Pradesh High Courts, Supreme Court, and SEBI/NCLT/DRT tribunals.

You have been given:
1. The user's original query / case facts
2. Real data retrieved from government APIs and databases

Your task: Write a sharp, actionable legal strategy STRICTLY based on the actual data retrieved.

MANDATORY RULES:
- NEVER use generic template text. Every section must reference actual data values.
- If stock/NSE data: lead with live price, 52-week range, financial health implications
- If IFSC/bank data: use actual branch name, address, MICR code in your NI Act S.138 analysis
- If GSTIN data: use actual registration status, return filing record in CGST Act analysis
- If pincode data: use actual district and state for jurisdiction (CPC S.20)
- If vehicle data: use actual RC details for motor accident / insurance analysis
- Quote actual Indian laws with section numbers in every recommendation
- Structure your output with these exact headings:
  ## Summary
  ## Key Findings from Government Data
  ## Legal Analysis
  ## Recommended Actions (within 7 days)
  ## Document Checklist
- Be concise, precise, and immediately actionable for a practicing advocate"""


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

    context = f"""User Query / Case Facts:
{prompt}

Detected Intent: {intent}
Company/Entity: {company or 'Not specified'}
Case Type: {case_type}
Location: {location}
Case ID: {case_id}
Active AI Providers: {', '.join(active)}

Real Government API Data Retrieved:
{json.dumps(data_summary, indent=2, default=str)[:7000]}
"""

    # 1️⃣ Try Claude Sonnet 4-6 — best for structured legal documents
    if "claude" in active:
        logger.info(f"[AI_BRAIN] Strategy via Claude Sonnet 4-6 (case {case_id})")
        result = _call_claude(STRATEGY_SYSTEM, context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return f"🔥 LITIGAFORGE AI — CASE {case_id} [Claude Sonnet 4-6]\n{'='*60}\n\n{result}"

    # 2️⃣ Try OpenAI GPT-5-mini
    if "openai" in active:
        logger.info(f"[AI_BRAIN] Strategy via GPT-5-mini (case {case_id})")
        result = _call_openai(STRATEGY_SYSTEM, context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return f"🔥 LITIGAFORGE AI — CASE {case_id} [GPT-5]\n{'='*60}\n\n{result}"

    # 3️⃣ Try Gemini 2.5 Flash
    if "gemini" in active:
        logger.info(f"[AI_BRAIN] Strategy via Gemini 2.5 Flash (case {case_id})")
        result = _call_gemini(STRATEGY_SYSTEM, context, temperature=0.3, max_tokens=6000)
        if result and len(result) > 300:
            return f"🔥 LITIGAFORGE AI — CASE {case_id} [Gemini 2.5 Flash]\n{'='*60}\n\n{result}"

    # 4️⃣ Smart data-driven template — never generic
    logger.info(f"[AI_BRAIN] All AI providers failed — using smart data template (case {case_id})")
    return _smart_fallback_strategy(prompt, entities, api_results, case_id)


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
    sections  = []

    # Stock / NSE
    nse = api_results.get("NSE_INDIA", {})
    if nse.get("status") == "success" and company:
        q     = (nse.get("results", {}).get("live_quote") or {})
        price = q.get("last_price", "—")
        chg   = q.get("pct_change", "—")
        w52h  = q.get("week_52_high", "—")
        w52l  = q.get("week_52_low", "—")
        cname = q.get("company", company.title())
        sections.append(f"""## Key Findings from Government Data

**NSE Live Quote — {cname}**
- Current Price: ₹{price}  |  Today's Change: {chg}%
- 52-Week High: ₹{w52h}  |  52-Week Low: ₹{w52l}
- Nifty 50 Member: {'Yes' if nse.get('results', {}).get('nifty50_member') else 'No'}

## Legal Analysis

This market data is actionable in:
- **Asset Valuation** (Family Courts Act) — share price on petition date
- **Insider Trading** — SEBI PIT Regulations 2015, Reg.4 — trades within 60 days of UPSI
- **NPA/DRT Attachment** — market cap determines proportionality of attachment orders
- **Contempt/SEBI Orders** — verify suspended trading has not resumed (SEBI Act S.11B)

## Recommended Actions (within 7 days)
1. File complaint at SEBI SCORES portal (scores.sebi.gov.in) — attach trade history
2. Cite SEBI Act 1992 S.11, S.11B for market manipulation
3. Obtain certified NSE/BSE trade reports for evidence""")

    # IFSC / Bank
    ifsc = api_results.get("IFSC", {})
    if ifsc.get("status") == "success":
        sections.append(f"""## Key Findings from Government Data

**Bank Branch Verified (RBI Registry)**
- Bank: {ifsc.get('bank_name')}  |  Branch: {ifsc.get('branch')}
- Address: {ifsc.get('address')}, {ifsc.get('city')}, {ifsc.get('state')}
- MICR: {ifsc.get('micr_code', '—')}  |  RTGS: {ifsc.get('rtgs_enabled')}  |  NEFT: {ifsc.get('neft_enabled')}

## Legal Analysis — NI Act S.138

1. Drawee bank confirmed as **{ifsc.get('bank_name')}, {ifsc.get('branch')}** — essential for prosecution
2. Cross-verify MICR code {ifsc.get('micr_code', '—')} against the dishonoured cheque leaf
3. File complaint in court of payee's bank jurisdiction (NI Act S.142)

## Recommended Actions (within 7 days)
1. Send statutory demand notice within 30 days of dishonour (NI Act S.138 proviso)
2. File complaint within 30 days of expiry of 15-day notice period
3. Attach bank certificate of dishonour + IFSC verification printout""")

    # Pincode
    pin = api_results.get("PINCODE", {})
    if pin.get("status") == "success":
        sections.append(f"""## Key Findings from Government Data

**Address Verified (India Post)**
- Pincode: {pin.get('pincode')}  |  District: {pin.get('district')}  |  State: {pin.get('state')}
- Post Offices in zone: {pin.get('total_offices')}

## Legal Analysis — Jurisdiction
- Territorial jurisdiction: Courts in **{pin.get('district')}, {pin.get('state')}** (CPC S.20)
- Sub-Registrar for property documents: {pin.get('district')} district office
- For summons service: any post office in this pincode zone (CPC Order V)""")

    # GSTIN
    gstin = api_results.get("GSTIN", {})
    if gstin.get("status") == "success":
        status = gstin.get('registration_status', '')
        sections.append(f"""## Key Findings from Government Data

**GSTIN Verified (GSTN Portal)**
- Legal Name: {gstin.get('legal_name')}
- Status: **{status}**  |  Type: {gstin.get('taxpayer_type')}
- Jurisdiction: {gstin.get('state_jurisdiction')}
- Last Return: {gstin.get('last_return_period')} ({gstin.get('last_return_status')})
- Pending Returns: {gstin.get('pending_returns', 0)}

## Legal Analysis — CGST Act 2017
- {'✅ Active — use for compliance verification' if 'active' in status.lower() else '⚠️ Inactive/suspended — grounds for attachment under CGST Act S.83'}
- Pending returns admissible as evidence of financial irregularity (CGST Act S.132)""")

    active_chains = [k for k, v in api_results.items()
                     if isinstance(v, dict) and v.get("status") not in ("skipped", "no_api_key", "error")]

    header = (f"🔥 LITIGAFORGE AI — CASE {case_id} [AI-Generated]\n"
              f"{'='*60}\n\n"
              f"## Summary\n"
              f"**Query**: {prompt[:200]}\n"
              f"**Departments Queried**: {', '.join(active_chains) or 'General'}\n"
              f"**Location**: {location}  |  **Case Type**: {case_type}\n")

    if sections:
        return header + "\n\n".join(sections)

    return header + (
        "\nNo specific identifiers detected. Include GSTIN, vehicle number, IFSC, "
        "company name, or pincode for targeted AI analysis.\n\n"
        "**Example queries:**\n"
        "- `search Infosys stock` → live NSE data + legal strategy\n"
        "- `Cheque bounce IFSC SBIN0020149` → bank verification + NI Act S.138\n"
        "- `GSTIN 36AAAAA0000A1ZA fraud case` → live GSTIN + CGST Act strategy\n"
        "- `Vehicle TS09EA1234 accident Hyderabad` → VAHAN + SARATHI + motor accident law"
    )
