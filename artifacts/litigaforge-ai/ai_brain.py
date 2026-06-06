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
import asyncio
import os
import re
import json
import logging
from typing import Dict, Any

import requests as _req

AI_CALL_TIMEOUT = 15.0  # seconds — each model gets this before falling through

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
# Async wrappers — each model gets AI_CALL_TIMEOUT seconds, then falls through
# ──────────────────────────────────────────────────────────────────────────────

async def _call_claude_async(system: str, user: str, temperature: float = 0.3,
                              max_tokens: int = 8000) -> str | None:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_call_claude, system, user, temperature, max_tokens),
            timeout=AI_CALL_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning("[CLAUDE] timed out after %.0fs — falling through to next model", AI_CALL_TIMEOUT)
        return None
    except Exception as e:
        logger.warning("[CLAUDE] async call failed: %s", e)
        return None


async def _call_gemini_async(system: str, user: str, temperature: float = 0.2,
                              max_tokens: int = 8192) -> str | None:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_call_gemini, system, user, temperature, max_tokens),
            timeout=AI_CALL_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning("[GEMINI] timed out after %.0fs — falling through to next model", AI_CALL_TIMEOUT)
        return None
    except Exception as e:
        logger.warning("[GEMINI] async call failed: %s", e)
        return None


async def _call_openai_async(system: str, user: str, temperature: float = 0.3,
                              max_tokens: int = 8000) -> str | None:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_call_openai, system, user, temperature, max_tokens),
            timeout=AI_CALL_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning("[OPENAI] timed out after %.0fs — falling through to next model", AI_CALL_TIMEOUT)
        return None
    except Exception as e:
        logger.warning("[OPENAI] async call failed: %s", e)
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Entity Extraction — Gemini leads (fast), regex fallback
# ──────────────────────────────────────────────────────────────────────────────

EXTRACT_SYSTEM = """You are an expert legal entity extractor for Indian law cases operating in Telangana and Andhra Pradesh.

Given ANY user input — a legal case description, a casual stock query, a vehicle lookup,
a GST question, or anything else — extract ALL relevant entities with maximum precision.

EXTRACTION RULES:
1. Identify ALL parties (plaintiff/petitioner, defendant/respondent, opposing counsel if named)
2. Extract ALL government identifiers: GSTIN, PAN, Aadhaar, vehicle number, DL, IFSC, CIN, pincode
3. Detect case type from keywords AND context (not just keyword matching)
4. Identify the primary relief sought (money, injunction, declaration, possession, compensation, etc.)
5. Note the procedural stage if mentioned (pre-litigation, filed, notice served, hearing pending, judgment reserved)
6. Extract dates mentioned (accident date, contract date, notice date, limitation deadline)
7. Identify the primary legal domain (civil, criminal, constitutional, tax, labour, consumer, property, family, corporate)
8. Default state_code to TS (Telangana) if not mentioned; AP if Andhra Pradesh cities are named

Return ONLY valid JSON. Use null for missing fields. Do not include markdown.
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
  "stock_symbol": "NSE symbol or null",
  "currency": "Foreign currency code or null",
  "party_name": "Primary party name or null",
  "party_role": "plaintiff | petitioner | complainant | applicant | appellant | null",
  "opponent_name": "Opposing party name or null",
  "opponent_role": "defendant | respondent | accused | opposite_party | null",
  "case_number": "Case number if any or null",
  "cnr_number": "CNR number if any or null",
  "court_name": "Court or tribunal name or null",
  "case_type": "Detected case type or null",
  "legal_domain": "civil | criminal | constitutional | tax | labour | consumer | property | family | corporate | general | null",
  "relief_sought": "Primary relief: money | injunction | declaration | possession | compensation | divorce | bail | null",
  "procedural_stage": "pre-litigation | notice_stage | filed | summons | hearing | arguments | reserved | judgment | appeal | null",
  "key_dates": {"contract_date": "YYYY-MM-DD or null", "notice_date": "YYYY-MM-DD or null", "accident_date": "YYYY-MM-DD or null", "limitation_deadline": "YYYY-MM-DD or null"},
  "amount_in_dispute": "Numeric amount with currency or null",
  "state_code": "2-letter Indian state code or TS by default",
  "location": "City or district name or null",
  "intent": "stock_lookup | gstin_lookup | vehicle_lookup | ifsc_lookup | pincode_lookup | forex_lookup | company_lookup | legal_case | general",
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
CASE ANALYSIS REPORT
==================

1. CASE SUMMARY
---------------
[A concise 3-5 sentence narrative of the dispute. Capture the parties, the cause of action, the relief sought, and the current procedural posture. Base every fact on the user's input or verified API data. No speculation.]

2. KEY LEGAL ISSUES
-------------------
- Primary Issue: [The central legal question the court/tribunal must decide]
- Secondary Issue(s):
  - [Subsidiary legal question]
  - [Procedural or evidentiary hurdle]

3. APPLICABLE LAWS & PROVISIONS
--------------------------------
| Act / Regulation | Section / Rule | Relevance to This Case |
|------------------|----------------|------------------------|
| [Act Name, Year] | Section X | [One-line relevance: what it mandates/prohibits/permits for this dispute] |
| [Act Name, Year] | Section Y | [One-line relevance] |

[Every law must have a verifiable Act name, year, and section number. If a provision is only tentatively applicable, note it as "Tentative — requires factual confirmation."]

4. RELEVANT CASE LAW
--------------------
- [Case Name] ([Year]) [Court] — [One-line holding and why it supports or distinguishes this case]
- [Precedent] — [Ratio decidendi relevant to the facts]
[If no directly applicable precedents can be identified, state: "No directly on-point precedents identified from current data."]

5. RECOMMENDED LEGAL STRATEGY
-----------------------------
Immediate Actions (0-7 days):
- Action 1: [Specific step] — [Legal basis: Act, Section] — [Responsible party]
- Action 2: [Specific step] — [Legal basis] — [Responsible party]

Short-Term Actions (7-30 days):
- Action 1: [Specific step] — [Legal basis]
- Action 2: [Specific step] — [Legal basis]

Medium-Term Actions (1-3 months):
- Action 1: [Specific step] — [Legal basis]
[Each action must be specific enough to act upon immediately. No vague advice.]

7. DOCUMENTS REQUIRED
---------------------
Essential (without which the case cannot proceed):
- [ ] [Document name] — [Purpose and who provides it]
- [ ] [Document name] — [Purpose]

Supporting (strengthens the case):
- [ ] [Document name] — [Purpose]
- [ ] [Document name] — [Purpose]

8. POTENTIAL RISKS & CHALLENGES
-------------------------------
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [Specific risk, e.g., limitation bar] | High / Medium / Low | [Specific mitigation step] |
| [Jurisdictional objection] | Medium | [Pre-emptive filing strategy] |

9. NEXT STEPS
-------------
1. [Immediate concrete action — who does what by when]
2. [Next concrete action with deadline]
3. [Longer-term action with estimated timeline]

10. CONFIDENCE & LIMITATIONS
-----------------------------
Confidence Level: [High / Medium / Low] — [Brief justification based on data completeness]
Limitations:
- [What this analysis cannot determine without further evidence]
- [What additional facts would improve the quality of advice]
- [Jurisdictional or procedural caveats]

---
NOTE: This analysis is generated by LitigaForge AI and is legal information, not legal advice. The final strategy must be validated by a qualified advocate admitted to practice in the relevant jurisdiction before any court or tribunal filing. Statutory references are current as of the date of generation; recent amendments may apply.
"""

STRATEGY_SYSTEM = """You are a senior Indian advocate with 20+ years of practice before the High Courts of Telangana, Andhra Pradesh, and the Supreme Court of India. You are drafting a case analysis memorandum for a fellow advocate or for your own file. The reader is a busy litigator who needs actionable, precise guidance in under 3 minutes.

WRITING PRINCIPLES:
1. TONE: Authoritative, concise, senior-counsel level. No hedging ("maybe", "perhaps", "it is suggested"). Use "requires", "mandates", "prohibits", "entitles".
2. FACTS: Every fact must trace to the user's input or a verified government API result. Never invent parties, dates, amounts, or legal provisions.
3. LAW: Every statute must include the Act name, year, and specific section number. Every case law must include the case name, year, and court.
4. STRATEGY: Each recommended action must name (a) the specific step, (b) the legal basis (Act + Section), and (c) who is responsible. No vague advice.
5. RISKS: Identify SPECIFIC risks (limitation bars, jurisdictional objections, evidentiary gaps) — not generic warnings.
6. OUTPUT RULES:
   - Use ONLY the exact section headings in LEGAL_OUTPUT_FORMAT.
   - Maximum length: 1200 words. A busy advocate must read this in under 3 minutes.
   - If a section genuinely has no content, write "Not applicable" — do not omit the heading.
   - Never include marketing language, emojis, ASCII art, or self-referential AI commentary.
   - Never include generic boilerplate examples, sample clauses, or template text.
   - Present tables where the format calls for them (Applicable Laws, Risks, Government Data)."""


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

    safe_context = wrap_user_prompt(f"""CASE FACTS:
{prompt}

EXTRACTED ENTITIES:
- Intent: {intent}
- Case Type: {case_type}
- Location: {location}
- Company/Entity: {company or 'Not specified'}
- State Code: {entities.get('state_code', 'TS')}
- Parties: {entities.get('party_name', 'Not specified')} vs {entities.get('opponent_name', 'Not specified')}
- Identifiers: PAN={entities.get('pan', 'N/A')}, GSTIN={entities.get('gstin', 'N/A')}, Vehicle={entities.get('vehicle_number', 'N/A')}, CIN={entities.get('cin', 'N/A')}

{LEGAL_OUTPUT_FORMAT}

VERIFIED GOVERNMENT API DATA:
{json.dumps(data_summary, indent=2, default=str)[:7000]}

Active AI Providers: {', '.join(active)}
Case ID: {case_id}
""")

    # Cascade: Claude (best structured writing) → GPT-5 → Gemini → smart template
    strategy_text = None
    if "claude" in active:
        logger.info(f"[AI_BRAIN] Strategy via Claude Sonnet 4-6 (case {case_id})")
        strategy_text = _call_claude(STRATEGY_SYSTEM, safe_context, temperature=0.25, max_tokens=8000)
        if strategy_text and len(strategy_text) > 400:
            return safe_ai_output(strategy_text, api_results)

    if "openai" in active:
        logger.info(f"[AI_BRAIN] Strategy via GPT-5-mini (case {case_id})")
        strategy_text = _call_openai(STRATEGY_SYSTEM, safe_context, temperature=0.25, max_tokens=8000)
        if strategy_text and len(strategy_text) > 400:
            return safe_ai_output(strategy_text, api_results)

    if "gemini" in active:
        logger.info(f"[AI_BRAIN] Strategy via Gemini 2.5 Flash (case {case_id})")
        strategy_text = _call_gemini(STRATEGY_SYSTEM, safe_context, temperature=0.25, max_tokens=8192)
        if strategy_text and len(strategy_text) > 400:
            return safe_ai_output(strategy_text, api_results)

    logger.info(f"[AI_BRAIN] All AI providers failed — using smart data template (case {case_id})")
    fallback = _smart_fallback_strategy(prompt, entities, api_results, case_id)
    return safe_ai_output(fallback, None)


# ──────────────────────────────────────────────────────────────────────────────
# Section Refinement — regenerate one section with full case context
# ──────────────────────────────────────────────────────────────────────────────

REFINE_INSTRUCTIONS = {
    "refine": """Refine this section: improve clarity, structure, and completeness. Keep every fact from the original. Add any missing detail that strengthens the analysis without inventing facts. Maintain the same format (bullets, tables, etc.).""",
    "aggressive": """Make this section more aggressive and assertive. Use stronger legal language. Frame positions as demands rather than suggestions. Emphasize the strongest legal remedies available. Highlight opponent vulnerabilities. Use phrases like "strictly mandates", "categorically requires", "unequivocally entitled to". Keep all facts; do not add unsupported claims.""",
    "provisions": """Expand this section with additional legal provisions, statutes, rules, and regulations. Add specific section numbers, sub-sections, and relevant amendments. Include procedural rules (CPC CrPC rules, tribunal rules) where applicable. Reference relevant SEBI/CGST/RBI/MV Act provisions. Keep existing content; add supplementary provisions.""",
    "simplify": """Simplify this section into plain, accessible English. Shorten sentences. Remove dense legal jargon where possible (but keep Act names and section numbers). Use analogies or plain explanations for complex concepts. A client with no legal background should understand it. Preserve all factual content and legal accuracy.""",
}

REFINE_SYSTEM = """You are a senior Indian advocate editing one section of a case analysis memorandum. You are given the FULL case context and asked to rewrite ONLY one section.

RULES:
1. Output ONLY the rewritten section content. Do NOT include section headings, numbering, or metadata.
2. Preserve all facts from the original section. Do not invent new facts.
3. Maintain the same structural format (tables, bullet lists, checklists) unless the instruction explicitly changes style.
4. Match the tone described in the instruction.
5. Every legal reference must keep the Act name, year, and section number.
6. Maximum length: keep it roughly the same length as the original, unless adding provisions.
7. Do not include any introductory text like "Here is the refined section:" — output the content directly."""


def smart_refine_section(
    original_prompt: str,
    section_name: str,
    current_text: str,
    full_output: str,
    instruction: str,
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    """Regenerate a single section with full case context. Cascade: Claude → GPT-5 → Gemini."""
    _init_providers()
    active = get_active_providers()

    modifier = REFINE_INSTRUCTIONS.get(instruction, REFINE_INSTRUCTIONS["refine"])

    safe_context = wrap_user_prompt(f"""FULL CASE FACTS:
{original_prompt}

ORIGINAL COMPLETE ANALYSIS (for context only):
{full_output[:4000]}

VERIFIED GOVERNMENT DATA:
{json.dumps(api_results, indent=2, default=str)[:3000]}

SECTION TO REWRITE: {section_name}

CURRENT SECTION TEXT:
{current_text[:4000]}

INSTRUCTION:
{modifier}

REWRITE ONLY THE SECTION CONTENT. Do not include heading or numbering.""")

    # Cascade: Claude → GPT-5 → Gemini
    if "claude" in active:
        logger.info(f"[AI_BRAIN] Refine via Claude (section: {section_name}, case: {case_id})")
        result = _call_claude(REFINE_SYSTEM, safe_context, temperature=0.2, max_tokens=4000)
        if result and len(result) > 50:
            return safe_ai_output(result, api_results)

    if "openai" in active:
        logger.info(f"[AI_BRAIN] Refine via GPT-5-mini (section: {section_name}, case: {case_id})")
        result = _call_openai(REFINE_SYSTEM, safe_context, temperature=0.2, max_tokens=4000)
        if result and len(result) > 50:
            return safe_ai_output(result, api_results)

    if "gemini" in active:
        logger.info(f"[AI_BRAIN] Refine via Gemini (section: {section_name}, case: {case_id})")
        result = _call_gemini(REFINE_SYSTEM, safe_context, temperature=0.2, max_tokens=4096)
        if result and len(result) > 50:
            return safe_ai_output(result, api_results)

    # Fallback: return original with note
    logger.info(f"[AI_BRAIN] All AI providers failed for refinement — returning original (case {case_id})")
    return current_text + "\n\n[Note: AI refinement unavailable at this time. Original text preserved.]"


# ──────────────────────────────────────────────────────────────────────────────
# Async versions of the two public functions — used by the async engine nodes
# Each model gets AI_CALL_TIMEOUT seconds; on timeout it falls through silently.
# ──────────────────────────────────────────────────────────────────────────────

async def smart_legal_strategy_async(
    prompt: str,
    entities: Dict[str, Any],
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    """Async strategy synthesis: Claude → GPT-5 → Gemini → smart template, 15 s per model."""
    _init_providers()
    active = get_active_providers()

    intent    = entities.get("intent", "legal_case")
    company   = entities.get("company_name", "")
    case_type = entities.get("case_type", "General")
    location  = entities.get("location", "Hyderabad")

    data_summary = {
        chain: result for chain, result in api_results.items()
        if isinstance(result, dict) and result.get("status") not in ("skipped", None)
    }

    safe_context = wrap_user_prompt(f"""CASE FACTS:
{prompt}

EXTRACTED ENTITIES:
- Intent: {intent}
- Case Type: {case_type}
- Location: {location}
- Company/Entity: {company or 'Not specified'}
- State Code: {entities.get('state_code', 'TS')}
- Parties: {entities.get('party_name', 'Not specified')} vs {entities.get('opponent_name', 'Not specified')}
- Identifiers: PAN={entities.get('pan', 'N/A')}, GSTIN={entities.get('gstin', 'N/A')}, Vehicle={entities.get('vehicle_number', 'N/A')}, CIN={entities.get('cin', 'N/A')}

{LEGAL_OUTPUT_FORMAT}

VERIFIED GOVERNMENT API DATA:
{json.dumps(data_summary, indent=2, default=str)[:7000]}

Active AI Providers: {', '.join(active)}
Case ID: {case_id}
""")

    if "claude" in active:
        logger.info("[AI_BRAIN] [async] Strategy via Claude Sonnet 4-6 (case %s)", case_id)
        result = await _call_claude_async(STRATEGY_SYSTEM, safe_context, temperature=0.25, max_tokens=8000)
        if result and len(result) > 400:
            return safe_ai_output(result, api_results)

    if "openai" in active:
        logger.info("[AI_BRAIN] [async] Strategy via GPT-5-mini (case %s)", case_id)
        result = await _call_openai_async(STRATEGY_SYSTEM, safe_context, temperature=0.25, max_tokens=8000)
        if result and len(result) > 400:
            return safe_ai_output(result, api_results)

    if "gemini" in active:
        logger.info("[AI_BRAIN] [async] Strategy via Gemini 2.5 Flash (case %s)", case_id)
        result = await _call_gemini_async(STRATEGY_SYSTEM, safe_context, temperature=0.25, max_tokens=8192)
        if result and len(result) > 400:
            return safe_ai_output(result, api_results)

    logger.info("[AI_BRAIN] [async] All AI providers timed out/failed — smart template (case %s)", case_id)
    fallback = _smart_fallback_strategy(prompt, entities, api_results, case_id)
    return safe_ai_output(fallback, None)


async def smart_refine_section_async(
    original_prompt: str,
    section_name: str,
    current_text: str,
    full_output: str,
    instruction: str,
    api_results: Dict[str, Any],
    case_id: str,
) -> str:
    """Async section refinement: Claude → GPT-5 → Gemini, 15 s per model."""
    _init_providers()
    active = get_active_providers()

    modifier = REFINE_INSTRUCTIONS.get(instruction, REFINE_INSTRUCTIONS["refine"])

    safe_context = wrap_user_prompt(f"""FULL CASE FACTS:
{original_prompt}

ORIGINAL COMPLETE ANALYSIS (for context only):
{full_output[:4000]}

VERIFIED GOVERNMENT DATA:
{json.dumps(api_results, indent=2, default=str)[:3000]}

SECTION TO REWRITE: {section_name}

CURRENT SECTION TEXT:
{current_text[:4000]}

INSTRUCTION:
{modifier}

REWRITE ONLY THE SECTION CONTENT. Do not include heading or numbering.""")

    if "claude" in active:
        logger.info("[AI_BRAIN] [async] Refine via Claude (section: %s, case: %s)", section_name, case_id)
        result = await _call_claude_async(REFINE_SYSTEM, safe_context, temperature=0.2, max_tokens=4000)
        if result and len(result) > 50:
            return safe_ai_output(result, api_results)

    if "openai" in active:
        logger.info("[AI_BRAIN] [async] Refine via GPT-5-mini (section: %s, case: %s)", section_name, case_id)
        result = await _call_openai_async(REFINE_SYSTEM, safe_context, temperature=0.2, max_tokens=4000)
        if result and len(result) > 50:
            return safe_ai_output(result, api_results)

    if "gemini" in active:
        logger.info("[AI_BRAIN] [async] Refine via Gemini (section: %s, case: %s)", section_name, case_id)
        result = await _call_gemini_async(REFINE_SYSTEM, safe_context, temperature=0.2, max_tokens=4096)
        if result and len(result) > 50:
            return safe_ai_output(result, api_results)

    logger.info("[AI_BRAIN] [async] All AI providers timed out for refinement — original preserved (case %s)", case_id)
    return current_text + "\n\n[Note: AI refinement unavailable at this time. Original text preserved.]"


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

    # Build structured output matching the new LEGAL_OUTPUT_FORMAT
    lines = [
        "CASE ANALYSIS REPORT",
        "====================",
        "",
        f"Case ID: {case_id} | Date: {__import__('datetime').datetime.now().strftime('%d %b %Y')} | Jurisdiction: {location}, {entities.get('state_code', 'TS')}",
        "",
        "1. CASE SUMMARY",
        "---------------",
        prompt[:400] if len(prompt) > 20 else "No case facts provided.",
        "",
        "2. KEY LEGAL ISSUES",
        "-------------------",
    ]

    # Add issues based on intent with more specificity
    if "stock" in intent or "nse" in intent:
        lines.append(f"Primary Issue: Securities law compliance and valuation of listed assets involving {company or 'the company'}.")
        lines.append("Secondary Issue(s):")
        lines.append("  - Potential insider trading or market manipulation under SEBI Act 1992, S.12A")
        lines.append("  - UPSI disclosure obligations under SEBI (PIT) Regulations 2015, Reg. 4")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("Primary Issue: Dishonour of cheque and recovery under Negotiable Instruments Act 1881, S.138.")
        lines.append("Secondary Issue(s):")
        lines.append("  - Territorial jurisdiction of the drawee bank (NI Act 1881, S.142)")
        lines.append("  - Limitation period for filing complaint (NI Act 1881, S.142 read with Limitation Act 1963, Art. 35)")
    elif "gstin" in intent or "gst" in intent:
        lines.append("Primary Issue: Tax compliance and registration status under CGST Act 2017.")
        lines.append("Secondary Issue(s):")
        lines.append("  - Attachment risk under CGST Act 2017, S.83 if registration is inactive or cancelled")
        lines.append("  - Penalty exposure under CGST Act 2017, S.132 for tax evasion")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("Primary Issue: Motor vehicle accident liability under Motor Vehicles Act 1988, S.166.")
        lines.append("Secondary Issue(s):")
        lines.append("  - Insurance claim validity based on RC and permit status (MV Act 1988, S.146)")
        lines.append("  - Quantum of compensation under structured formula (MV Act 1988, S.168)")
    elif "pincode" in intent or "property" in intent:
        lines.append("Primary Issue: Territorial jurisdiction for civil proceedings (CPC 1908, S.20).")
        lines.append("Secondary Issue(s):")
        lines.append("  - Venue for sub-registrar verification and summons service (CPC 1908, O.V)")
        lines.append("  - Title verification and encumbrance check (Registration Act 1908, S.17)")
    else:
        lines.append("Primary Issue: General legal matter requiring further factual clarification.")
        lines.append("Secondary Issue(s):")
        lines.append("  - Jurisdiction and applicable substantive law to be determined after full fact-finding")
        lines.append("  - Limitation period assessment requires complete chronology of events")

    lines.extend([
        "",
        "3. APPLICABLE LAWS & PROVISIONS",
        "--------------------------------",
        "| Act / Regulation | Section / Rule | Relevance to This Case |",
        "|------------------|----------------|------------------------|",
    ])

    if "stock" in intent or "nse" in intent:
        lines.append("| SEBI Act 1992 | S.11, S.11B, S.12A | Market manipulation and insider trading prohibition |")
        lines.append("| SEBI (PIT) Regulations 2015 | Reg. 4 | UPSI disclosure obligations |")
        lines.append("| Companies Act 2013 | S.447 | Fraud in relation to securities |")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("| Negotiable Instruments Act 1881 | S.138 | Cheque dishonour and penalty |")
        lines.append("| Negotiable Instruments Act 1881 | S.142 | Jurisdiction for complaint filing |")
        lines.append("| RBI Act 1934 | S.35A | Banking regulation and customer grievance |")
    elif "gstin" in intent or "gst" in intent:
        lines.append("| CGST Act 2017 | S.83 | Provisional attachment in pending proceedings |")
        lines.append("| CGST Act 2017 | S.132 | Tax evasion and penalties |")
        lines.append("| CGST Act 2017 | S.29 | Cancellation of registration |")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("| Motor Vehicles Act 1988 | S.146 | Compulsory third-party insurance |")
        lines.append("| Motor Vehicles Act 1988 | S.166 | Claim for compensation (MACT) |")
        lines.append("| Motor Vehicles Act 1988 | S.168 | Structured formula for compensation |")
    elif "pincode" in intent or "property" in intent:
        lines.append("| CPC 1908 | S.20 | Place of suing (territorial jurisdiction) |")
        lines.append("| CPC 1908 | O.V | Service of summons |")
        lines.append("| Registration Act 1908 | S.17 | Documents requiring compulsory registration |")
    else:
        lines.append("| To be determined | — | Requires review of complete case facts |")

    lines.extend([
        "",
        "4. RELEVANT CASE LAW",
        "--------------------",
        "No directly on-point precedents identified from current data. Research recommended on IndianKanoon.org.",
        "",
        "5. GOVERNMENT DATA FINDINGS",
        "---------------------------",
    ])
    if gov_data:
        lines.append("| Source | Finding | Data Point |")
        lines.append("|--------|---------|------------|")
        for item in gov_data:
            parts = item.split(":", 1)
            if len(parts) == 2:
                lines.append(f"| {parts[0].strip()} | {parts[1].strip()} | Verified |")
            else:
                lines.append(f"| {item} | — | Verified |")
    else:
        lines.append("No government data available for this case. Verification recommended via official portals.")

    lines.extend([
        "",
        "6. RECOMMENDED LEGAL STRATEGY",
        "-----------------------------",
        "Immediate Actions (0-7 days):",
    ])

    if "stock" in intent or "nse" in intent:
        lines.append(f"- Action 1: Obtain certified NSE/BSE trade reports for the disputed period involving {company or 'the company'} — SEBI Act 1992, S.11 — Client/Investor")
        lines.append("- Action 2: File complaint on SEBI SCORES portal (scores.sebi.gov.in) with complete trade history — SEBI Act 1992, S.11B — Client")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("- Action 1: Send statutory demand notice under NI Act S.138 within 30 days of dishonour — NI Act 1881, S.138 — Payee/Client")
        lines.append("- Action 2: Preserve bank memo and dishonoured cheque as primary evidence — NI Act 1881, S.138 — Payee")
    elif "gstin" in intent or "gst" in intent:
        lines.append("- Action 1: Verify registration status on GSTN portal and preserve screenshots — CGST Act 2017, S.25 — Client/Taxpayer")
        lines.append("- Action 2: File DRC-01 if tax demand arises; seek stay under CGST Act S.83 if attachment threatened — CGST Act 2017, S.83 — Client")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("- Action 1: File insurance claim with RC, permit, and FIR copies within 30 days — MV Act 1988, S.146 — Claimant")
        lines.append("- Action 2: Initiate MACT proceedings under Motor Vehicles Act S.166 for compensation — MV Act 1988, S.166 — Claimant/Lawyer")
    elif "pincode" in intent or "property" in intent:
        lines.append("- Action 1: Verify territorial jurisdiction at district court of {location} — CPC 1908, S.20 — Lawyer")
        lines.append("- Action 2: Engage local process server for summons via registered post — CPC 1908, O.V — Lawyer")
    else:
        lines.append("- Action 1: Gather complete case facts and supporting documents — General — Client")
        lines.append("- Action 2: Identify all parties, causes of action, and desired relief — General — Lawyer")

    lines.extend([
        "",
        "Short-Term Actions (7-30 days):",
        "- Engage local counsel in the identified jurisdiction with relevant subject-matter expertise",
        "- Prepare draft pleadings (plaint/written statement) and evidence bundle index",
        "",
        "Medium-Term Actions (1-3 months):",
        "- File case before appropriate forum (District Court / High Court / Tribunal / Commission)",
        "- Prepare for first hearing with complete documentation and witness list",
        "",
        "7. DOCUMENTS REQUIRED",
        "---------------------",
        "Essential (without which the case cannot proceed):",
    ])

    if "stock" in intent or "nse" in intent:
        lines.append("- [ ] Certified NSE/BSE trade reports — Primary evidence of trades")
        lines.append("- [ ] SEBI SCORES complaint acknowledgement — Proof of regulatory complaint")
        lines.append("- [ ] Board resolutions and insider trading policy (if corporate) — Evidence of compliance framework")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("- [ ] Dishonoured cheque and bank memo — Primary evidence of dishonour")
        lines.append("- [ ] Statutory demand notice with proof of service — Mandatory precondition under NI Act S.138")
        lines.append("- [ ] IFSC verification printout from RBI registry — Bank branch verification")
    elif "gstin" in intent or "gst" in intent:
        lines.append("- [ ] GST registration certificate and ARN — Proof of registration status")
        lines.append("- [ ] Return filing history (GSTR-1, GSTR-3B) — Compliance evidence")
        lines.append("- [ ] Demand-cum-show-cause notice (if any) — Basis of the dispute")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("- [ ] FIR copy and police investigation report — Crime record")
        lines.append("- [ ] RC book and valid insurance policy — Vehicle ownership and insurance coverage")
        lines.append("- [ ] Medical records and disability certificate (if injury) — Quantum of compensation evidence")
    elif "pincode" in intent or "property" in intent:
        lines.append("- [ ] Sale deed / title documents — Proof of ownership")
        lines.append("- [ ] Encumbrance certificate (EC) for 30 years — Title verification")
        lines.append("- [ ] Address proof and voter ID for summons verification — Service of process")
    else:
        lines.append("- [ ] All relevant contracts, correspondence, and receipts — Evidence of the dispute")
        lines.append("- [ ] Identity and address proof of all parties — Party verification")
        lines.append("- [ ] Timeline of events with dates and witnesses — Factual chronology")

    lines.extend([
        "",
        "Supporting (strengthens the case):",
        "- [ ] Expert opinion affidavit (if technical matter)",
        "- [ ] Affidavit of witness statements",
        "- [ ] Photographs or video evidence (if relevant)",
        "",
        "8. POTENTIAL RISKS & CHALLENGES",
        "-------------------------------",
        "| Risk | Likelihood | Mitigation |",
        "|------|------------|------------|",
    ])

    if "stock" in intent or "nse" in intent:
        lines.append("| SEBI investigation delay | Medium | File parallel civil suit for recovery |")
        lines.append("| Evidentiary gaps in trade records | Medium | Obtain certified broker statements |")
    elif "ifsc" in intent or "bank" in intent:
        lines.append("| Limitation bar under NI Act S.142 | High | Verify date of dishonour immediately; file within 30 days |")
        lines.append("| Jurisdictional objection | Medium | Confirm payee bank branch IFSC and jurisdiction |")
    elif "gstin" in intent or "gst" in intent:
        lines.append("| Provisional attachment under S.83 | High | File stay application before Adjudicating Authority |")
        lines.append("| Registration cancellation | Medium | Submit revocation application with compliance proof |")
    elif "vehicle" in intent or "vahan" in intent:
        lines.append("| Insurance claim denial | Medium | Verify policy validity and coverage exclusions |")
        lines.append("| Structured formula underestimation | Low | Engage actuary for future loss computation |")
    elif "pincode" in intent or "property" in intent:
        lines.append("| Title defect discovered | Medium | Obtain EC for 30 years before purchase |")
        lines.append("| Jurisdictional objection | Low | File in court of defendant's residence or property location |")
    else:
        lines.append("| Incomplete facts leading to incorrect strategy | High | Conduct detailed client interview immediately |")
        lines.append("| Limitation period expiry | Medium | Verify cause of action date and calculate limitation |")

    lines.extend([
        "",
        "9. NEXT STEPS",
        "-------------",
        "1. Retain a qualified advocate admitted to practice in the relevant jurisdiction within 7 days.",
        "2. Commence document collection and witness identification immediately.",
        "3. File case before appropriate forum within limitation period after complete preparation.",
        "",
        "10. CONFIDENCE & LIMITATIONS",
        "----------------------------",
        f"Confidence Level: {'Medium' if gov_data else 'Low'} — {'Government data partially available; further verification recommended.' if gov_data else 'Limited factual input and no government data retrieved.'}",
        "Limitations:",
        "- This analysis is based solely on the facts provided and government data available at generation time.",
        "- Additional facts may alter the legal position substantially.",
        "- Jurisdictional nuances (High Court, District Court, Tribunal, Commission) require case-specific advice.",
        "- Statutory references are current as of the date of generation; recent amendments may apply.",
        "- No privileged attorney-client relationship is created by this analysis.",
        "",
        "---",
        f"Generated by LitigaForge AI | Case ID: {case_id} | Chains Executed: {', '.join(active_chains) or 'General'}",
        "This is legal information, not legal advice. Consult a qualified advocate before taking any action.",
    ])

    return "\n".join(lines)
