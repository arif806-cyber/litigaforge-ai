"""
LitigaForge AI Brain — Gemini-powered intelligence layer.

Uses Replit's free Gemini AI integration (no API key from user needed).
Falls back gracefully to smart regex if Gemini is unavailable.

Capabilities:
  1. Smart entity extraction — understands natural language, not just keywords
  2. Intent detection — classifies what the user actually wants
  3. Data-driven strategy synthesis — reads real chain results, produces relevant output
"""
import os
import re
import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger("litigaforge.ai_brain")

# ── Gemini via Replit AI Integrations (free, no user key needed) ──────────────
# Replit's Gemini proxy endpoint: POST {BASE_URL}/models/{model}:generateContent
# (no /v1 or /v1beta prefix — Replit's proxy uses the bare path)

import requests as _requests

_GEMINI_BASE: str = ""
_GEMINI_KEY:  str = ""
_GEMINI_READY: bool | None = None   # None = not yet probed


def _ensure_gemini() -> bool:
    global _GEMINI_BASE, _GEMINI_KEY, _GEMINI_READY
    if _GEMINI_READY is not None:
        return _GEMINI_READY
    _GEMINI_BASE = os.getenv("AI_INTEGRATIONS_GEMINI_BASE_URL", "").rstrip("/")
    _GEMINI_KEY  = os.getenv("AI_INTEGRATIONS_GEMINI_API_KEY", "")
    if not _GEMINI_BASE:
        logger.warning("[AI_BRAIN] AI_INTEGRATIONS_GEMINI_BASE_URL not set — using regex fallback")
        _GEMINI_READY = False
        return False
    # Quick connectivity probe (max 5 s)
    try:
        url = f"{_GEMINI_BASE}/models/gemini-2.5-flash:generateContent"
        hdrs = {"x-goog-api-key": _GEMINI_KEY, "Content-Type": "application/json"}
        body = {"contents": [{"role": "user", "parts": [{"text": "ping"}]}],
                "generationConfig": {"maxOutputTokens": 5}}
        r = _requests.post(url, json=body, headers=hdrs, timeout=5)
        _GEMINI_READY = r.status_code == 200
        if _GEMINI_READY:
            logger.info("[AI_BRAIN] Gemini 2.5 Flash ready via Replit AI Integrations")
        else:
            logger.warning(f"[AI_BRAIN] Gemini probe failed (HTTP {r.status_code})")
    except Exception as e:
        logger.warning(f"[AI_BRAIN] Gemini probe error: {e}")
        _GEMINI_READY = False
    return _GEMINI_READY


def _call_gemini(system: str, user: str, temperature: float = 0.2) -> str | None:
    if not _ensure_gemini():
        return None
    url  = f"{_GEMINI_BASE}/models/gemini-2.5-flash:generateContent"
    hdrs = {"x-goog-api-key": _GEMINI_KEY, "Content-Type": "application/json"}
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 8192},
    }
    try:
        r = _requests.post(url, json=body, headers=hdrs, timeout=45)
        if r.status_code != 200:
            logger.warning(f"[AI_BRAIN] Gemini HTTP {r.status_code}: {r.text[:200]}")
            return None
        d = r.json()
        text = (
            d.get("candidates", [{}])[0]
             .get("content", {})
             .get("parts", [{}])[0]
             .get("text", "")
        )
        return text.strip() if text else None
    except Exception as e:
        logger.warning(f"[AI_BRAIN] Gemini call failed: {e}")
        return None


# ── Entity Extraction ─────────────────────────────────────────────────────────

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
  "party_name": "Person/company name involved as party or null",
  "opponent_name": "Opposing party name or null",
  "case_number": "Case number if any or null",
  "case_type": "Detected case type or null",
  "state_code": "2-letter Indian state code (TS, AP, MH, DL, KA...) or TS by default",
  "location": "City or district name or null",
  "intent": "One of: stock_lookup | gstin_lookup | vehicle_lookup | ifsc_lookup | pincode_lookup | forex_lookup | company_lookup | legal_case | general",
  "primary_query": "What the user is primarily asking for in one sentence"
}

CRITICAL RULES:
- If user mentions any stock/share/NSE/BSE/market/price/listed company → set company_name and intent=stock_lookup
- Common companies: infosys, tcs, reliance, wipro, hdfc, icici, sbi, adani, ongc, bajaj, mahindra, maruti, itc, airtel, sun pharma, dr reddy, cipla, titan, nestle, axis bank, kotak, l&t, ultratech, asian paints, hul
- If user types just "infosys" or "search TCS" → company_name = the company, intent = stock_lookup
- Extract company even from casual queries like "tell me about Reliance" or "Wipro stock"
- For IFSC: pattern is 4 letters + 0 + 6 alphanumeric (e.g. SBIN0000001, HDFC0001234)
- state_code default is TS (Telangana) if not mentioned
- Return ONLY the JSON, no markdown, no explanation"""


def smart_extract_entities(prompt: str) -> Dict[str, Any]:
    """
    Extract entities from user prompt using Gemini AI.
    Falls back to regex-based extraction if Gemini unavailable.
    """
    # Try Gemini first
    raw = _call_gemini(EXTRACT_SYSTEM, f"Extract entities from: {prompt}")
    if raw:
        try:
            # Strip markdown if any
            clean = raw.strip()
            if clean.startswith("```"):
                clean = re.sub(r"```(?:json)?", "", clean).strip().rstrip("`").strip()
            entities = json.loads(clean)
            entities = {k: v for k, v in entities.items() if v is not None and v != ""}
            logger.info(f"[AI_BRAIN] Gemini extracted: {list(entities.keys())}")
            return entities
        except Exception as e:
            logger.warning(f"[AI_BRAIN] JSON parse failed: {e} — raw: {raw[:100]}")

    # Fallback to enhanced regex extraction
    logger.info("[AI_BRAIN] Using enhanced regex fallback")
    return _regex_extract_entities(prompt)


def _regex_extract_entities(prompt: str) -> Dict[str, Any]:
    """Enhanced regex-based entity extraction — much smarter than before."""
    entities: Dict[str, Any] = {}
    p = prompt.strip()
    pl = p.lower()

    # ── Structured identifiers ────────────────────────────────────────────────
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

    # ── Company / stock intent — broad matching ───────────────────────────────
    COMPANIES = {
        "infosys": "infosys", "infy": "infosys",
        "tcs": "tcs", "tata consultancy": "tcs",
        "reliance": "reliance", "ril": "reliance",
        "wipro": "wipro",
        "hdfc": "hdfc", "hdfc bank": "hdfc",
        "icici": "icici", "icici bank": "icici",
        "sbi": "sbi", "state bank": "sbi",
        "bajaj": "bajaj", "bajaj finance": "bajaj",
        "adani": "adani",
        "ongc": "ongc",
        "ntpc": "ntpc",
        "coal india": "coal india",
        "hindalco": "hindalco",
        "mahindra": "mahindra", "m&m": "mahindra",
        "maruti": "maruti",
        "itc": "itc",
        "airtel": "airtel", "bharti airtel": "airtel",
        "sun pharma": "sun pharma",
        "dr reddy": "dr reddy",
        "cipla": "cipla",
        "hero motocorp": "hero motocorp",
        "axis bank": "axis bank",
        "kotak": "kotak",
        "l&t": "l&t", "larsen": "l&t",
        "ultratech": "ultratech",
        "asian paints": "asian paints",
        "hul": "hul", "hindustan unilever": "hul",
        "nestle": "nestle",
        "titan": "titan",
        "zomato": "zomato", "swiggy": "swiggy",
        "paytm": "paytm", "nykaa": "nykaa",
        "tata motors": "tata motors", "tata steel": "tata steel",
        "power grid": "power grid", "bpcl": "bpcl",
        "ioc": "ioc", "indian oil": "ioc",
        "hpcl": "hpcl",
    }
    for kw, canonical in COMPANIES.items():
        if kw in pl:
            entities["company_name"] = canonical
            break

    # Catch "stock of XYZ", "shares of XYZ", "search XYZ", "lookup XYZ"
    m = re.search(
        r'(?:stock|share|price|quote|nse|bse|search|lookup|find|check|tell me about|info(?:rmation)?\s+(?:of|about|on))\s+(?:of\s+)?([A-Za-z][A-Za-z\s&\.]{2,30}?)(?:\s+(?:stock|share|price|ltd|limited|pvt|corp|plc))?(?:\s|$|\.|\?|,)',
        pl
    )
    if m and "company_name" not in entities:
        candidate = m.group(1).strip().rstrip(" of about on")
        if len(candidate) >= 2 and candidate not in ("the", "an", "a", "my", "is", "are"):
            entities["company_name"] = candidate

    # Intent detection
    STOCK_SIGNALS = ["stock", "share", "nse", "bse", "market", "price", "listed", "dividend",
                     "ipo", "trading", "investor", "securities", "equity", "portfolio", "sensex", "nifty"]
    if "company_name" in entities or any(s in pl for s in STOCK_SIGNALS):
        entities["intent"] = "stock_lookup"
    elif entities.get("gstin"):
        entities["intent"] = "gstin_lookup"
    elif entities.get("vehicle_number"):
        entities["intent"] = "vehicle_lookup"
    elif entities.get("ifsc_code"):
        entities["intent"] = "ifsc_lookup"
    elif entities.get("pincode"):
        entities["intent"] = "pincode_lookup"
    else:
        entities["intent"] = "legal_case"

    # ── Case type ─────────────────────────────────────────────────────────────
    CASE_TYPES = {
        "eviction": "Rent Eviction", "rent": "Rent Eviction",
        "gst": "GST Dispute", "cheque": "Cheque Bounce",
        "divorce": "Matrimonial", "property": "Property Dispute",
        "motor": "Motor Accident", "accident": "Motor Accident",
        "criminal": "Criminal", "writ": "Writ Petition",
        "securities": "Securities Fraud", "insider": "Insider Trading",
        "npa": "NPA / DRT", "drt": "NPA / DRT",
        "insolvency": "Insolvency", "bank fraud": "Bank Fraud",
        "cheating": "Cheating / Fraud",
    }
    for kw, ct in CASE_TYPES.items():
        if kw in pl:
            entities["case_type"] = ct
            break

    # ── Party name ────────────────────────────────────────────────────────────
    for pat in [
        r'client\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'(?:Mr\.|Mrs\.|Dr\.|Adv\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
    ]:
        m = re.search(pat, p)
        if m: entities["party_name"] = m.group(1); break

    # ── LPG ──────────────────────────────────────────────────────────────────
    m = re.search(r'\b\d{12}\b', p)
    if m and "lpg" in pl: entities["lpg_id"] = m.group()

    # ── State / location ──────────────────────────────────────────────────────
    STATE_MAP = {
        "hyderabad": "TS", "telangana": "TS", "kukatpally": "TS",
        "secunderabad": "TS", "warangal": "TS", "nalgonda": "TS",
        "mumbai": "MH", "pune": "MH", "nagpur": "MH",
        "delhi": "DL", "new delhi": "DL",
        "bangalore": "KA", "bengaluru": "KA",
        "chennai": "TN", "coimbatore": "TN",
        "kolkata": "WB", "ahmedabad": "GJ",
        "vizag": "AP", "visakhapatnam": "AP", "vijayawada": "AP",
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


# ── Strategy Synthesis ────────────────────────────────────────────────────────

STRATEGY_SYSTEM = """You are a senior Indian advocate with 20 years of experience in Telangana and Andhra Pradesh High Courts.

You have been given:
1. The user's original query / case facts
2. Real data retrieved from government APIs and databases

Your job: Write a sharp, actionable legal strategy STRICTLY based on the actual data retrieved.

RULES:
- DO NOT use generic template text. Every point must reference the actual data.
- If stock/NSE data was retrieved: lead with stock analysis, share price, financial health
- If IFSC/bank data: focus on cheque bounce / bank fraud angle  
- If GSTIN data: focus on GST compliance and tax fraud angle
- If pincode data: use actual district/state for jurisdiction
- If vehicle data: motor accident / RC verification angle
- If NO specific legal case, just do a smart analysis of the data retrieved
- Use actual numbers, names, dates from the API results
- Structure: ## Summary | ## Key Findings | ## Legal Analysis | ## Recommended Actions | ## Document Checklist
- Keep it focused and practical — an advocate should be able to act on this immediately
- Mention specific laws with section numbers relevant to the data"""


def smart_legal_strategy(
    prompt: str,
    entities: Dict[str, Any],
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    """
    Generate intelligent, data-driven legal strategy using Gemini AI.
    Falls back to smart template if Gemini unavailable.
    """
    # Prepare a rich context for Gemini
    intent    = entities.get("intent", "legal_case")
    company   = entities.get("company_name", "")
    case_type = entities.get("case_type", "")
    location  = entities.get("location", "Hyderabad")

    # Build API results summary (only non-skipped results)
    data_summary = {}
    for chain, result in api_results.items():
        if isinstance(result, dict) and result.get("status") not in ("skipped", None):
            data_summary[chain] = result

    context = f"""User Query / Case Facts:
{prompt}

Detected Intent: {intent}
Company/Entity: {company or 'Not specified'}
Case Type: {case_type or 'Not specified'}
Location: {location}
Case ID: {case_id}

API Data Retrieved (real government data):
{json.dumps(data_summary, indent=2, default=str)[:6000]}
"""

    raw = _call_gemini(STRATEGY_SYSTEM, context, temperature=0.3)
    if raw and len(raw) > 200:
        logger.info(f"[AI_BRAIN] Gemini strategy generated ({len(raw)} chars)")
        return raw

    # Fallback: smart template that uses actual data
    logger.info("[AI_BRAIN] Using smart data-driven fallback strategy")
    return _smart_fallback_strategy(prompt, entities, api_results, case_id)


def _smart_fallback_strategy(
    prompt: str,
    entities: Dict[str, Any],
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    """Data-driven fallback strategy — uses real chain results, never generic text."""
    intent    = entities.get("intent", "legal_case")
    company   = entities.get("company_name", "")
    location  = entities.get("location", "Hyderabad")
    case_type = entities.get("case_type", "General Legal Matter")

    sections = []

    # ── Stock / NSE query ─────────────────────────────────────────────────────
    nse  = api_results.get("NSE_INDIA", {})
    stex = api_results.get("STOCK_EXCHANGE", {})
    if (nse.get("status") == "success" or stex.get("status") in ("success","partial")) and company:
        q = (nse.get("results", {}).get("live_quote") or {})
        price      = q.get("last_price", "—")
        chg        = q.get("pct_change", "—")
        w52h       = q.get("week_52_high", "—")
        w52l       = q.get("week_52_low", "—")
        cname      = q.get("company", company.title())
        nifty_mem  = nse.get("results", {}).get("nifty50_member", False)

        sections.append(f"""## Stock Market Data — {cname}

**Live Quote (NSE India)**
- Current Price: ₹{price}
- Today's Change: {chg}%
- 52-Week High: ₹{w52h}  |  52-Week Low: ₹{w52l}
- Nifty 50 Member: {'Yes' if nifty_mem else 'No'}

**Legal Significance**
This market data is relevant for:
- **Asset Valuation** — Share price used in divorce/partition proceedings (Family Courts Act)
- **Insider Trading** — SEBI (Prohibition of Insider Trading) Regulations 2015 — trade 60 days before price-sensitive information is material
- **NPA/DRT Attachment** — Current market cap determines if attachment order is proportionate
- **Contempt / SEBI Order** — Verify if suspended trading has resumed in violation of SEBI orders

**SEBI Complaint Process**
1. File complaint at SEBI SCORES portal (scores.sebi.gov.in)
2. Attach trade history screenshots + company announcements as evidence
3. Cite SEBI Act 1992 S.11, S.11B for market manipulation
4. For insider trading: SEBI PIT Regulations 2015, Reg.4""")

    # ── IFSC / Bank data ──────────────────────────────────────────────────────
    ifsc = api_results.get("IFSC", {})
    if ifsc.get("status") == "success":
        sections.append(f"""## Bank Branch Verification — {ifsc.get('ifsc_code')}

**Verified Details (RBI Registry)**
- Bank: {ifsc.get('bank_name')}
- Branch: {ifsc.get('branch')}
- Address: {ifsc.get('address')}
- City: {ifsc.get('city')}, {ifsc.get('state')}
- Contact: {ifsc.get('contact', '—')}
- RTGS: {ifsc.get('rtgs_enabled')}  |  NEFT: {ifsc.get('neft_enabled')}  |  IMPS: {ifsc.get('imps_enabled')}

**Legal Analysis — Cheque Bounce (NI Act S.138)**
1. Drawee bank confirmed as **{ifsc.get('bank_name')}, {ifsc.get('branch')}** — essential for NI Act S.138 prosecution
2. MICR: {ifsc.get('micr_code', '—')} — cross-verify with cheque leaf
3. File complaint in court having jurisdiction over the payee's bank (NI Act S.142)
4. Send statutory demand notice within 30 days of dishonour (NI Act S.138 proviso)
5. File complaint within 30 days of expiry of 15-day notice period""")

    # ── Pincode / Jurisdiction ────────────────────────────────────────────────
    pin = api_results.get("PINCODE", {})
    if pin.get("status") == "success":
        sections.append(f"""## Address & Jurisdiction — Pincode {pin.get('pincode')}

**Verified Location (India Post)**
- District: {pin.get('district')}
- State: {pin.get('state')}
- Post Offices: {pin.get('total_offices')} offices in this pincode zone

**Jurisdiction**
- Territorial jurisdiction: Courts in **{pin.get('district')}, {pin.get('state')}** (CPC S.20)
- For service of summons: Any post office in this zone can be used (CPC Order V)
- Property disputes: Sub-Registrar office for **{pin.get('district')}** district""")

    # ── GSTIN ─────────────────────────────────────────────────────────────────
    gstin = api_results.get("GSTIN", {})
    if gstin.get("status") == "success":
        sections.append(f"""## GST Registration — {gstin.get('gstin')}

**Verified Details (GSTN)**
- Legal Name: {gstin.get('legal_name')}
- Registration Status: **{gstin.get('registration_status')}**
- Taxpayer Type: {gstin.get('taxpayer_type')}
- Jurisdiction: {gstin.get('state_jurisdiction')}
- Last Return Filed: {gstin.get('last_return_period')} ({gstin.get('last_return_status')})
- Pending Returns: {gstin.get('pending_returns', 0)}

**Legal Analysis**
- {'✅ Active registration — business is GST-compliant' if 'active' in str(gstin.get('registration_status','')).lower() else '⚠️ Inactive/suspended registration — grounds for attachment'}
- Pending returns: {gstin.get('pending_returns', 0)} — {'No pending returns — clean compliance record' if not gstin.get('pending_returns') else 'Pending returns are admissible evidence of financial irregularity (CGST Act 2017 S.132)'}""")

    # ── Forex ─────────────────────────────────────────────────────────────────
    forex = api_results.get("FOREX", {})
    if forex.get("status") == "success":
        rates = forex.get("1_foreign_equals_inr", {})
        usd_rate = rates.get("USD", "—")
        gbp_rate = rates.get("GBP", "—")
        sections.append(f"""## Foreign Exchange Rates — {forex.get('rate_date')}

**Live INR Rates (ECB/Frankfurter)**
- 1 USD = ₹{usd_rate}
- 1 GBP = ₹{gbp_rate}
- 1 EUR = ₹{rates.get('EUR', '—')}
- 1 AED = ₹{rates.get('AED', '—')}
- 1 SAR = ₹{rates.get('SAR', '—')}

**Legal Use**
- Foreign asset valuation for divorce/partition (use RBI reference rate on transaction date for final court submission)
- FEMA 1999 — foreign transaction INR equivalent for remittance limit compliance
- PMLA 2002 — quantify proceeds of foreign fraud in INR""")

    # ── eCourts ───────────────────────────────────────────────────────────────
    ecourts = api_results.get("eCourts", {})
    if ecourts.get("cases"):
        c = ecourts["cases"][0]
        sections.append(f"""## eCourts — Existing Case Found

- Case Number: {c.get('case_number', '—')}
- Court: {c.get('court', '—')}
- Next Hearing: {c.get('next_hearing', 'TBD')}
- Status: {c.get('status', '—')}

**Action**: Ensure you appear on the next hearing date. Request certified copy of the order sheet.""")

    # ── Summary header ────────────────────────────────────────────────────────
    active_chains = [k for k, v in api_results.items()
                     if isinstance(v, dict) and v.get("status") not in ("skipped", "no_api_key", "error")]
    header = f"""## Summary — LitigaForge Analysis
**Query**: {prompt[:200]}
**Departments Queried**: {', '.join(active_chains) if active_chains else 'General'}
**Location**: {location}  |  **Case Type**: {case_type}
**Case ID**: {case_id}
"""

    if sections:
        return header + "\n\n".join(sections)

    # Absolute fallback — at least explain what was searched
    return header + f"""## Analysis
Your query was processed across {len(api_results)} government departments. 
{"No specific data identifiers (GSTIN/PAN/IFSC/vehicle/company) were detected in the query. " if not entities else ""}
Please include specific identifiers (GSTIN, vehicle number, IFSC code, company name, pincode) for targeted results.

**Try these example queries:**
- "Search Infosys stock price" → NSE live data + financial analysis
- "Cheque bounce — IFSC SBIN0020149" → Bank verification + NI Act S.138 strategy  
- "GSTIN 36AAAAA0000A1ZA GST fraud case" → Live GSTIN lookup + CGST Act strategy
- "Vehicle TS09EA1234 — motor accident case Hyderabad" → VAHAN + SARATHI + legal strategy
- "500001 property dispute Hyderabad" → Pincode + jurisdiction + property law strategy"""
