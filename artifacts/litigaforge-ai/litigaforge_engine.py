"""
LitigaForge AI Engine — LangGraph-powered legal API orchestration.
4-node pipeline: Entity Extractor → Orchestrator → Chain Executor → Meta Agent

Intelligence: Gemini AI via Replit AI Integrations (free, no user key needed).
Fallback: Smart regex + data-driven strategy templates.
Optional: Set OPENAI_API_KEY to use GPT-4o instead of Gemini.
"""
import os
import uuid
import json
import re
import logging
from typing import TypedDict, Annotated, List, Dict, Any
import operator

from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

from api_chains import CHAIN_MAP
from forge_memory import ForgeMemory
from alerts.whatsapp import send_whatsapp_alert
from ai_brain import smart_extract_entities, smart_legal_strategy

load_dotenv()
logger = logging.getLogger("litigaforge.engine")

memory = ForgeMemory()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_BASE    = os.getenv("AI_INTEGRATIONS_GEMINI_BASE_URL", "")

# AI_MODE resolution:
#   "gemini"         — default, free via Replit AI Integrations (no key needed)
#   "openai"         — optional override: set OPENAI_API_KEY + pip install langchain-openai
#   "smart_fallback" — regex + data-driven templates (Gemini unavailable)
if OPENAI_API_KEY:
    AI_MODE = "openai"
elif GEMINI_BASE:
    AI_MODE = "gemini"
else:
    AI_MODE = "smart_fallback"

DUMMY_MODE = (AI_MODE == "smart_fallback")

llm = None
if AI_MODE == "openai":
    try:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model=os.getenv("OPENAI_MODEL", "gpt-4o"), temperature=0.3, api_key=OPENAI_API_KEY)
        logger.info("AI MODE: OpenAI GPT-4o (optional override)")
    except ImportError:
        logger.warning("OPENAI_API_KEY set but langchain-openai not installed — falling back to Gemini")
        AI_MODE = "gemini" if GEMINI_BASE else "smart_fallback"
elif AI_MODE == "gemini":
    logger.info("AI MODE: Gemini 2.5 Flash — free via Replit AI Integrations")
else:
    logger.info("AI MODE: Smart fallback (regex + data-driven templates)")


# ─── Dummy LLM Responses ─────────────────────────────────────────────────────

def _dummy_extract_entities(prompt: str) -> Dict:
    """Parse entities from prompt using simple keyword matching."""
    entities = {}
    prompt_lower = prompt.lower()

    # GSTIN
    gstin_match = re.search(r'\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b', prompt)
    if gstin_match:
        entities["gstin"] = gstin_match.group()

    # PAN
    pan_match = re.search(r'\b[A-Z]{5}\d{4}[A-Z]{1}\b', prompt)
    if pan_match:
        entities["pan"] = pan_match.group()

    # Vehicle registration number
    vehicle_match = re.search(r'\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\b', prompt)
    if vehicle_match:
        entities["vehicle_number"] = vehicle_match.group()

    # IFSC code (11 chars: 4 alpha + 0 + 6 alphanum)
    ifsc_match = re.search(r'\b[A-Z]{4}0[A-Z0-9]{6}\b', prompt)
    if ifsc_match:
        entities["ifsc_code"] = ifsc_match.group()

    # Pincode (6 digits, not part of larger number)
    pin_match = re.search(r'(?<!\d)([1-9]\d{5})(?!\d)', prompt)
    if pin_match:
        entities["pincode"] = pin_match.group(1)

    # Stock / company name
    stock_keywords = [
        "infosys", "tcs", "reliance", "wipro", "hdfc", "icici", "sbi", "bajaj",
        "adani", "ongc", "ntpc", "coal india", "hindalco", "mahindra", "maruti",
        "itc", "bharti airtel", "sun pharma", "dr reddy", "cipla", "hero motocorp",
    ]
    for kw in stock_keywords:
        if kw in prompt_lower:
            entities["company_name"] = kw
            break
    # Also catch "shares of XYZ" or "listed company XYZ"
    stock_pattern = re.search(
        r'(?:shares?\s+of|stock\s+of|listed\s+company|company)\s+([A-Z][a-zA-Z\s]{2,30})',
        prompt, re.IGNORECASE
    )
    if stock_pattern and "company_name" not in entities:
        entities["company_name"] = stock_pattern.group(1).strip().lower()

    # Party name
    name_patterns = [
        r'client\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'(?:Mr\.|Mrs\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
    ]
    for pattern in name_patterns:
        match = re.search(pattern, prompt)
        if match:
            entities["party_name"] = match.group(1)
            break

    # Case type
    case_types = {
        "eviction": "Rent Eviction",
        "gst": "GST Dispute",
        "cheque": "Cheque Bounce",
        "divorce": "Matrimonial",
        "property": "Property Dispute",
        "motor": "Motor Accident",
        "criminal": "Criminal",
        "writ": "Writ Petition",
        "securities": "Securities Fraud",
        "insider": "Insider Trading",
        "npa": "NPA / DRT",
        "drt": "NPA / DRT",
        "insolvency": "Insolvency",
        "bank fraud": "Bank Fraud",
    }
    for keyword, case_type in case_types.items():
        if keyword in prompt_lower:
            entities["case_type"] = case_type
            break

    # LPG
    lpg_match = re.search(r'\b\d{12}\b', prompt)
    if lpg_match and "lpg" in prompt_lower:
        entities["lpg_id"] = lpg_match.group()

    svid_match = re.search(r'(?:svid|voucher)[:\s]+(\d{4,8})', prompt_lower)
    if svid_match:
        entities["svid"] = svid_match.group(1)

    # State / location
    state_map = {
        "hyderabad": "TS", "telangana": "TS", "kukatpally": "TS",
        "secunderabad": "TS", "warangal": "TS", "nalgonda": "TS",
        "mumbai": "MH", "pune": "MH", "nagpur": "MH",
        "delhi": "DL", "new delhi": "DL",
        "bangalore": "KA", "bengaluru": "KA",
        "chennai": "TN", "coimbatore": "TN",
        "kolkata": "WB", "ahmedabad": "GJ",
    }
    for city, code in state_map.items():
        if city in prompt_lower:
            entities["state_code"] = code
            entities["location"] = city.title()
            break

    if "state_code" not in entities:
        entities["state_code"] = "TS"

    return entities


def _dummy_plan_chains(entities: Dict) -> List[str]:
    """Pick chains based on available entity data."""
    chains = []

    # ── Identity & tax ────────────────────────────────────────────────────────
    if entities.get("gstin"):
        chains.append("GSTIN")
    if entities.get("pan"):
        chains.append("PAN")
    if entities.get("aadhaar"):
        chains.append("DigiLocker")

    # ── Vehicle & transport ───────────────────────────────────────────────────
    if entities.get("vehicle_number"):
        chains.append("VAHAN")
        if entities.get("state_code", "TS") in ("TS", "AP", "TG"):
            chains.append("TRANSPORT_TS")
    if entities.get("dl_number"):
        chains.append("SARATHI")
        if entities.get("state_code", "TS") in ("TS", "AP", "TG"):
            if "TRANSPORT_TS" not in chains:
                chains.append("TRANSPORT_TS")

    # ── Finance & markets ─────────────────────────────────────────────────────
    if entities.get("company_name"):
        # Use NSE_INDIA (free, no key) + STOCK_EXCHANGE (RapidAPI, richer data)
        chains.append("NSE_INDIA")
        chains.append("STOCK_EXCHANGE")
    if entities.get("cin"):
        chains.append("MCA_COMPANY")
    if entities.get("company_name") and "MCA_COMPANY" not in chains:
        chains.append("MCA_COMPANY")
    if entities.get("currency") or entities.get("foreign_amount"):
        chains.append("FOREX")
    if entities.get("ifsc_code"):
        chains.append("IFSC")

    # ── Address ───────────────────────────────────────────────────────────────
    if entities.get("pincode"):
        chains.append("PINCODE")

    # ── State services ────────────────────────────────────────────────────────
    if entities.get("lpg_id"):
        chains.append("BPCL_LPG")

    # ── Defaults if nothing else matched ─────────────────────────────────────
    if not chains:
        chains = ["PAN", "DigiLocker"]

    # ── Always run ────────────────────────────────────────────────────────────
    chains.append("MERIPEHCHAAN")
    if entities.get("state_code", "TS") in ("TS", "AP", "TG"):
        chains.append("MEE_SEVA_TG")
    chains.append("eCourts")

    return chains


def _dummy_legal_strategy(prompt: str, entities: Dict, api_results: Dict, case_id: str) -> str:
    party = entities.get("party_name", "Client")
    location = entities.get("location", "Hyderabad")
    case_type = entities.get("case_type", "Legal Matter")
    ecourts = api_results.get("eCourts", {})
    cases = ecourts.get("cases", [])
    pan_data = api_results.get("PAN", {})
    gstin_data = api_results.get("GSTIN", {})
    digilocker_data = api_results.get("DigiLocker", {})

    case_summary_extra = ""
    if cases:
        c = cases[0]
        case_summary_extra = f"An existing case ({c.get('case_number', 'N/A')}) was found in eCourts with next hearing on {c.get('next_hearing', 'TBD')}."

    gstin_line = ""
    if gstin_data and gstin_data.get("status") not in ("skipped", None):
        gstin_line = f"- GST registration status: {gstin_data.get('registration_status', 'Active')} — last return filed {gstin_data.get('last_return_filed', 'March 2026')}."

    docs_available = ""
    if digilocker_data and digilocker_data.get("documents_found"):
        doc_names = [d.get("name", "") for d in digilocker_data["documents_found"]]
        docs_available = f"DigiLocker shows: {', '.join(doc_names)} are available and verified."

    strategy = f"""## Case Summary
This case involves {party} from {location} seeking legal resolution for a {case_type} matter.
{case_summary_extra}
PAN verification status: {pan_data.get('verified', True)} — identity confirmed.
{gstin_line}
{docs_available}

## Legal Strengths
1. **Identity & Documentation Verified** — PAN is active and Aadhaar-seeded, establishing clear identity of the party.
2. **Government Records Support Claim** — DigiLocker documents (Income Certificate, Domicile Certificate) are digitally verified and admissible as evidence under the IT Act 2000, Section 65B.
3. **Prior Case Precedent** — eCourts search reveals related case history that can be used to demonstrate pattern of conduct by the opposing party.
4. **Jurisdiction Established** — Case falls clearly under the jurisdiction of courts in {location}, Telangana, with applicable state-specific laws.
5. **GST Compliance Record** — GST filings are up to date, strengthening financial credibility of the client.

## Legal Risks & Red Flags
1. **Limitation Period** — Verify that the case is filed within the limitation period under the Limitation Act 1963. Rent disputes: 3 years from date of default.
2. **Pending Returns** — Any unfiled GST returns may be used by opposing counsel to question financial standing.
3. **Documentary Gaps** — Ensure original rent agreement / lease deed is available. Digital copies alone may require additional certification.
4. **Opposing Party Absconding** — If the opposing party is not traceable, service of notice may require court permission for substituted service (Order V, Rule 20 CPC).

## Strategy Recommendations
1. **File Eviction Petition** under Section 10 of the Telangana Buildings (Lease, Rent and Eviction) Control Act, 1960 before the Rent Control Court, {location}.
2. **Send Legal Notice** via registered post + WhatsApp (for digital trail) under Section 106 of the Transfer of Property Act, 1882 — give 15-day notice to vacate.
3. **Attach DigiLocker Documents** as certified digital evidence under Section 65B of the Indian Evidence Act, 1872.
4. **File GST Dispute** separately before the GST Appellate Authority under Section 107 of the CGST Act, 2017 — do not club with civil suit.
5. **Apply for Interim Relief** under Order XXXIX Rules 1 & 2 of CPC to restrain the respondent from alienating the property pending disposal.
6. **Engage a Process Server** immediately to ensure timely service of summons on the respondent.

## Document Checklist
- Original Rent Agreement / Lease Deed (mandatory)
- Proof of non-payment of rent (bank statements, demand notices)
- Aadhaar Card (verified via DigiLocker)
- Income Certificate (verified via DigiLocker)
- GST Registration Certificate (GSTIN verified)
- Property Tax receipts (to establish ownership)
- Previous court orders, if any (from eCourts)
- WhatsApp/email communication records with the tenant

## Recommended Next Steps (within 7 days)
1. Day 1-2: Obtain certified copies of all DigiLocker documents
2. Day 2: Draft and send Legal Notice via registered AD post
3. Day 3: File Eviction Petition in Rent Control Court, {location}
4. Day 4: Apply for interim stay order
5. Day 5-6: Collect proof of delivery of legal notice
6. Day 7: Appear before court for first hearing date allocation"""

    return strategy


def _dummy_suggestions(prompt: str) -> List[str]:
    prompt_lower = prompt.lower()
    base = ["Activate Watch Mode on eCourts for automatic hearing date alerts"]
    if "gst" in prompt_lower:
        base.append("Cross-chain GSTIN + PAN + eCourts for combined tax + civil dispute strategy")
    if "eviction" in prompt_lower or "rent" in prompt_lower:
        base.append("MSME + DigiLocker chain to check if tenant has business registration — grounds for commercial eviction rate")
    if "vehicle" in prompt_lower or "motor" in prompt_lower:
        base.append("VAHAN + SARATHI + insurance verification chain for motor accident liability assessment")
    return base[:3]


def _invoke_llm_or_dummy(prompt_text: str, fallback_fn, *args):
    if DUMMY_MODE:
        return fallback_fn(*args)
    try:
        response = llm.invoke(prompt_text)
        return response.content
    except Exception as e:
        logger.warning(f"LLM call failed ({e}), using dummy fallback")
        return fallback_fn(*args)


# ─── State ────────────────────────────────────────────────────────────────────

class LitigaState(TypedDict):
    case_id: str
    user_prompt: str
    extracted_entities: Dict[str, Any]
    planned_chains: List[str]
    api_results: Dict[str, Any]
    meta_suggestions: List[str]
    chain_map: List[Dict]
    final_output: str
    forge_memory: Annotated[List[str], operator.add]
    approved: bool


# ─── Node 1: Entity Extractor ─────────────────────────────────────────────────

def entity_extractor(state: LitigaState) -> LitigaState:
    logger.info(f"[{state['case_id']}] Extracting entities (AI_MODE={AI_MODE})")

    if AI_MODE == "openai" and llm:
        prompt = f"""You are a legal entity extraction specialist for Indian law.
Extract from the user prompt (return null for missing):
- gstin, pan, aadhaar, vehicle_number, dl_number
- ifsc_code, pincode, cin, company_name (NSE/BSE listed), stock_symbol
- currency, party_name, opponent_name, case_number, case_type
- state_code (2-letter: TS, AP, MH...), location
- intent: stock_lookup | gstin_lookup | vehicle_lookup | ifsc_lookup | pincode_lookup | forex_lookup | company_lookup | legal_case | general

IMPORTANT: If user mentions any company or stock/share/NSE/BSE/market → set company_name and intent=stock_lookup.
Respond ONLY with valid JSON. No markdown.
User Prompt: {state['user_prompt']}"""
        try:
            response = llm.invoke(prompt)
            raw = response.content.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            entities = json.loads(raw)
        except Exception as e:
            logger.warning(f"OpenAI entity extraction failed ({e}), using AI brain fallback")
            entities = smart_extract_entities(state["user_prompt"])
    else:
        # Gemini or smart_fallback — both handled by ai_brain
        entities = smart_extract_entities(state["user_prompt"])

    state["extracted_entities"] = {k: v for k, v in entities.items() if v is not None and v != ""}
    logger.info(f"[{state['case_id']}] Entities extracted: {list(state['extracted_entities'].keys())}")
    logger.info(f"[{state['case_id']}] Intent: {state['extracted_entities'].get('intent', 'unknown')}")
    return state


# ─── Node 2: Orchestrator ─────────────────────────────────────────────────────

def orchestrator(state: LitigaState) -> LitigaState:
    logger.info(f"[{state['case_id']}] Planning chains (AI_MODE={AI_MODE})")

    if DUMMY_MODE:
        valid = _dummy_plan_chains(state["extracted_entities"])
    else:
        past = memory.get_relevant_patterns(state["user_prompt"])
        memory_ctx = "\n".join(f"- {p['prompt_snippet']} → {p['chains_used']}" for p in past) or "No prior patterns."
        prompt = f"""
You are LitigaForge Orchestrator. Available chains: GSTIN, PAN, DigiLocker, eCourts, VAHAN, SARATHI
User Prompt: {state['user_prompt']}
Entities: {state['extracted_entities']}
Past Memory: {memory_ctx}
Return ONLY a JSON array of chain names to run in order. No markdown.
"""
        try:
            response = llm.invoke(prompt)
            raw = response.content.strip().strip("```json").strip("```").strip()
            planned = json.loads(raw)
            valid = [c for c in planned if c in CHAIN_MAP]
            if not valid:
                raise ValueError("empty")
        except Exception:
            valid = _dummy_plan_chains(state["extracted_entities"])

    state["planned_chains"] = valid
    state["chain_map"] = [{"chain": c, "status": "queued"} for c in valid]
    logger.info(f"[{state['case_id']}] Chains: {valid}")
    return state


# ─── Node 3: Chain Executor ───────────────────────────────────────────────────

def execute_chains(state: LitigaState) -> LitigaState:
    logger.info(f"[{state['case_id']}] Executing {len(state['planned_chains'])} chain(s)")
    entities = state["extracted_entities"]
    results = {}

    for chain_name in state["planned_chains"]:
        fn = CHAIN_MAP.get(chain_name)
        if not fn:
            results[chain_name] = {"chain": chain_name, "status": "unknown"}
            continue
        try:
            result = fn(
                gstin=entities.get("gstin"),
                pan=entities.get("pan"),
                aadhaar=entities.get("aadhaar"),
                vehicle_number=entities.get("vehicle_number"),
                dl_number=entities.get("dl_number"),
                party_name=entities.get("party_name"),
                case_number=entities.get("case_number"),
                state_code=entities.get("state_code", "TS"),
                name=entities.get("party_name"),
                # New departments
                ifsc_code=entities.get("ifsc_code"),
                pincode=entities.get("pincode"),
                company_name=entities.get("company_name"),
                stock_symbol=entities.get("stock_symbol"),
                address=entities.get("address"),
            )
            results[chain_name] = result
            for cm in state["chain_map"]:
                if cm["chain"] == chain_name:
                    cm["status"] = result.get("status", "done")
        except Exception as e:
            results[chain_name] = {"chain": chain_name, "status": "error", "detail": str(e)}
            for cm in state["chain_map"]:
                if cm["chain"] == chain_name:
                    cm["status"] = "error"

    state["api_results"] = results
    return state


# ─── Node 4: Meta Agent ───────────────────────────────────────────────────────

def meta_agent(state: LitigaState) -> LitigaState:
    logger.info(f"[{state['case_id']}] Running Meta Agent (AI_MODE={AI_MODE})")

    if AI_MODE == "openai" and llm:
        past = memory.get_relevant_patterns(state["user_prompt"], limit=3)
        memory_ctx = "\n".join(f"- {p['prompt_snippet']} → {p['meta_suggestions']}" for p in past) or "First case."
        prompt = f"""You are LitigaForge Meta Agent — a senior Indian legal strategist AI with expertise in Telangana/AP law.
CASE ID: {state['case_id']}
PROMPT: {state['user_prompt']}
INTENT: {state['extracted_entities'].get('intent', 'legal_case')}
ENTITIES: {json.dumps(state['extracted_entities'], default=str)}
API RESULTS:
{json.dumps(state['api_results'], indent=2, default=str)[:5000]}
FORGE MEMORY: {memory_ctx}

Write a professional legal strategy STRICTLY based on the actual API results above.
Use real data — numbers, names, dates from the results. DO NOT use generic templates.
Structure: ## Summary | ## Key Findings from Data | ## Legal Analysis | ## Recommended Actions | ## Document Checklist"""
        try:
            response = llm.invoke(prompt)
            strategy_text = response.content
        except Exception as e:
            logger.warning(f"OpenAI meta agent failed ({e}), using AI brain")
            strategy_text = smart_legal_strategy(
                state["user_prompt"], state["extracted_entities"],
                state["api_results"], state["case_id"]
            )
        try:
            sug = llm.invoke(
                f"Extract 1-3 creative 'Unthought Chain' ideas as a JSON array of short strings.\n"
                f"Analysis: {strategy_text[:600]}\nReturn ONLY a JSON array."
            )
            suggestions = json.loads(sug.content.strip().strip("```json").strip("```").strip())
        except Exception:
            suggestions = _dummy_suggestions(state["user_prompt"])
    else:
        # Gemini or smart fallback — both via ai_brain
        strategy_text = smart_legal_strategy(
            state["user_prompt"], state["extracted_entities"],
            state["api_results"], state["case_id"]
        )
        suggestions = _dummy_suggestions(state["user_prompt"])

    disclaimer = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY LEGAL DISCLAIMER — ADVOCATES ACT 1961
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LitigaForge AI output is AI-generated and must be independently
verified by the licensed advocate. It does NOT constitute legal advice.
The advocate bears full responsibility under the Advocates Act 1961
and Bar Council of India Rules.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""

    mode_tag = "[DUMMY MODE — Add OPENAI_API_KEY for real AI output]" if DUMMY_MODE else "[AI-Generated]"
    chain_status = " | ".join(f"{c['chain']}:{c['status']}" for c in state["chain_map"])

    final_output = (
        f"🔥 LITIGAFORGE AI — CASE {state['case_id']} {mode_tag}\n{'='*60}\n\n"
        f"{strategy_text}\n\n{'='*60}\n"
        f"UNTHOUGHT CHAINS:\n" + "\n".join(f"  → {s}" for s in suggestions) +
        f"\n\nCHAINS  : {', '.join(state['planned_chains'])}\n"
        f"STATUS  : {chain_status}\n{'='*60}\n\n{disclaimer}"
    )

    state["final_output"] = final_output
    state["meta_suggestions"] = suggestions
    state["forge_memory"].append(f"[{state['case_id']}] {state['user_prompt'][:100]} → {suggestions}")

    memory.save_pattern(state["user_prompt"], state["planned_chains"], suggestions, strategy_text[:300])
    memory.save_case(state["case_id"], state["user_prompt"], state["api_results"], final_output)
    return state


# ─── Build Graph ──────────────────────────────────────────────────────────────

_wf = StateGraph(LitigaState)
_wf.add_node("entity_extractor", entity_extractor)
_wf.add_node("orchestrator", orchestrator)
_wf.add_node("execute_chains", execute_chains)
_wf.add_node("meta_agent", meta_agent)
_wf.set_entry_point("entity_extractor")
_wf.add_edge("entity_extractor", "orchestrator")
_wf.add_edge("orchestrator", "execute_chains")
_wf.add_edge("execute_chains", "meta_agent")
_wf.add_edge("meta_agent", END)
forge_graph = _wf.compile()


def forge_case(user_prompt: str) -> dict:
    case_id = str(uuid.uuid4())[:8].upper()
    return forge_graph.invoke({
        "case_id": case_id,
        "user_prompt": user_prompt,
        "extracted_entities": {},
        "planned_chains": [],
        "api_results": {},
        "meta_suggestions": [],
        "chain_map": [],
        "final_output": "",
        "forge_memory": [],
        "approved": False,
    })


if __name__ == "__main__":
    from logger import get_logger
    _log = get_logger("litigaforge.engine")
    _log.info("Run via main.py or API, not directly.")
