"""
LitigaForge AI — FastAPI Server
Full REST API for legal case forging, watch mode, forge memory, WhatsApp alerts,
user authentication (register/login/me), and subscription management.
"""
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, APIRouter, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("litigaforge.api")

from litigaforge_engine import forge_case, memory
from alerts.whatsapp import send_whatsapp_alert, send_hearing_reminder
from watch_mode import WatchModeManager
from database import (
    create_user, get_user_by_email, get_user_by_id,
    increment_case_count, update_subscription, SUBSCRIPTION_PLANS, TIER_LIMITS,
)
from auth import hash_password, verify_password, create_token, get_current_user, require_user

watcher = WatchModeManager(memory=memory, alert_fn=send_whatsapp_alert)
BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("WATCH_MODE_AUTO_START", "false").lower() == "true":
        watcher.start()
    yield
    watcher.stop()


app = FastAPI(
    title="LitigaForge AI",
    description="Self-Evolving Legal API Forge for Hyderabad/Telangana Advocates",
    version="3.0.0",
    lifespan=lifespan,
    root_path=BASE_PATH,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

router = APIRouter()


# ─── Pydantic models ───────────────────────────────────────────────────────────

class ForgeRequest(BaseModel):
    prompt: str
    notify_whatsapp: bool = False
    advocate_phone: Optional[str] = None

class WatchRequest(BaseModel):
    party_name: Optional[str] = None
    case_number: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = ""

class AlertRequest(BaseModel):
    message: str
    phone: Optional[str] = None
    alert_type: str = "info"

class HearingReminderRequest(BaseModel):
    case_number: str
    court: str
    date: str
    party: str
    phone: Optional[str] = None

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    user_type: str = "advocate"

class DraftRequest(BaseModel):
    template_id: str
    variables: dict = {}
    custom_instructions: str = ""

class ResearchRequest(BaseModel):
    query: str
    jurisdiction: str = "Telangana"

class LoginRequest(BaseModel):
    email: str
    password: str

class UpgradeRequest(BaseModel):
    tier: str


# ─── Root / health ─────────────────────────────────────────────────────────────

@router.get("/")
async def root():
    docs_path = f"{BASE_PATH}/docs" if BASE_PATH else "/docs"
    return {
        "name": "LitigaForge AI",
        "version": "3.0.0",
        "status": "running",
        "watch_mode_active": watcher.is_running,
        "forge_memory": memory.stats(),
        "docs": docs_path,
    }


@router.get("/healthz")
async def health():
    from ai_brain import get_active_providers
    active = get_active_providers()
    if len(active) >= 2:
        ai_mode = "multi"
    elif active:
        ai_mode = active[0]
    else:
        ai_mode = "smart_fallback"
    return {
        "status": "ok",
        "service": "LitigaForge AI",
        "ai_mode": ai_mode,
        "active_providers": active,
        "dummy_mode": ai_mode == "smart_fallback",
    }


# ─── Auth routes ───────────────────────────────────────────────────────────────

@router.post("/auth/register")
async def register(req: RegisterRequest):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(req.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name is too short")
    valid_types = ("advocate", "client")
    user_type = req.user_type if req.user_type in valid_types else "advocate"
    try:
        user = create_user(
            email=req.email,
            name=req.name,
            password_hash=hash_password(req.password),
            user_type=user_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    token = create_token(user["id"])
    return {"token": token, "user": user}


@router.post("/auth/login")
async def login(req: LoginRequest):
    user = get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    # Remove password hash from response
    user.pop("password_hash", None)
    token = create_token(user["id"])
    return {"token": token, "user": user}


@router.get("/auth/me")
async def me(current_user: dict = Depends(require_user)):
    return current_user


# ─── Subscription routes ───────────────────────────────────────────────────────

@router.get("/subscription/plans")
async def subscription_plans():
    return SUBSCRIPTION_PLANS


@router.post("/subscription/upgrade")
async def subscription_upgrade(req: UpgradeRequest, current_user: dict = Depends(require_user)):
    valid_tiers = [p["id"] for p in SUBSCRIPTION_PLANS]
    if req.tier not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Choose from: {valid_tiers}")
    updated = update_subscription(current_user["id"], req.tier)
    return {"message": f"Subscription updated to {req.tier}", "user": updated}


# ─── Forge ─────────────────────────────────────────────────────────────────────

@router.post("/forge")
async def forge(request: ForgeRequest, background_tasks: BackgroundTasks,
                current_user: Optional[dict] = Depends(get_current_user)):
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # Enforce monthly case limits for authenticated users
    if current_user:
        tier = current_user.get("subscription_tier", "free")
        limit = TIER_LIMITS.get(tier, 5)
        used = current_user.get("cases_this_month", 0)
        if limit != -1 and used >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Monthly case limit reached ({limit} cases for {tier} plan). Upgrade your subscription to continue.",
            )

    try:
        result = forge_case(request.prompt)
    except Exception as e:
        logger.exception("Engine error")
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")

    # Increment counter for authenticated users
    if current_user:
        try:
            increment_case_count(current_user["id"])
        except Exception:
            logger.warning("Failed to increment case count for user %s", current_user["id"])

    if request.notify_whatsapp:
        summary = (
            f"Case {result['case_id']} forged.\nChains: {', '.join(result['planned_chains'])}\n"
            + "\n".join(f"• {s}" for s in result.get("meta_suggestions", []))
        )
        background_tasks.add_task(
            send_whatsapp_alert, message=summary, to=request.advocate_phone, alert_type="forge"
        )

    # Extract which AI provider generated the strategy (from header line)
    import re as _re
    _provider_match = _re.search(r'\[([^\]]+)\|', result["final_output"])
    _provider_raw = _provider_match.group(1).strip() if _provider_match else "Smart Template"
    if "Claude" in _provider_raw:
        ai_provider = "claude"
        ai_provider_label = "Claude Sonnet 4-6"
    elif "GPT" in _provider_raw or "gpt" in _provider_raw:
        ai_provider = "openai"
        ai_provider_label = "GPT-4o"
    elif "Gemini" in _provider_raw:
        ai_provider = "gemini"
        ai_provider_label = "Gemini 2.5 Flash"
    else:
        ai_provider = "template"
        ai_provider_label = "Smart Template"

    return {
        "status": "success",
        "case_id": result["case_id"],
        "chains_executed": result["planned_chains"],
        "chain_map": result["chain_map"],
        "entities_found": result["extracted_entities"],
        "api_results": result["api_results"],
        "meta_suggestions": result["meta_suggestions"],
        "final_output": result["final_output"],
        "ai_provider": ai_provider,
        "ai_provider_label": ai_provider_label,
    }


# ─── Cases ─────────────────────────────────────────────────────────────────────

@router.get("/cases")
async def list_cases(limit: int = 10):
    cases = memory.get_recent_cases(limit=limit)
    return {
        "total": len(cases),
        "cases": [
            {"case_id": c["case_id"], "timestamp": c["timestamp"], "prompt_preview": c["prompt"][:100]}
            for c in reversed(cases)
        ],
    }


@router.get("/cases/{case_id}")
async def get_case(case_id: str):
    case = memory.get_case(case_id.upper())
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    return case


@router.get("/memory/patterns")
async def get_patterns(limit: int = 50):
    patterns = memory.get_all_patterns()
    return {"total_patterns": len(patterns), "patterns": patterns[-limit:]}


@router.get("/memory/stats")
async def memory_stats():
    return memory.stats()


# ─── Chains ────────────────────────────────────────────────────────────────────

@router.get("/chains")
async def list_chains():
    from api_chains import CHAIN_MAP
    departments = {
        "Identity & Tax": [
            {"name": "GSTIN",        "description": "GST registration status, filing history, taxpayer details"},
            {"name": "PAN",          "description": "PAN verification, name match, Aadhaar seeding status"},
            {"name": "DigiLocker",   "description": "Aadhaar, income, domicile certificates via API Setu"},
            {"name": "MERIPEHCHAAN", "description": "DigiLocker OAuth2 SSO — all citizen documents (NIC/MeitY)"},
        ],
        "Courts": [
            {"name": "eCourts",      "description": "Case search by party name or case number — all Indian courts"},
        ],
        "Transport & Vehicle": [
            {"name": "VAHAN",        "description": "Vehicle RC, owner, insurance, fitness, tax validity"},
            {"name": "SARATHI",      "description": "Driving licence holder, validity, vehicle classes"},
            {"name": "TRANSPORT_TS", "description": "Vehicle RC & DL — API Setu sandbox (TS/AP)"},
        ],
        "State Services": [
            {"name": "BPCL_LPG",    "description": "LPG Subscription Voucher — Ministry of Petroleum (BPCL)"},
            {"name": "MEE_SEVA_TG", "description": "Mee Seva Telangana — 11 state certificates via API Setu"},
        ],
        "Finance & Markets": [
            {"name": "NSE_INDIA",      "description": "NSE India live stock quotes, OHLC, 52-week range — free"},
            {"name": "STOCK_EXCHANGE", "description": "NSE/BSE financials, shareholding pattern — RapidAPI"},
            {"name": "FOREX",          "description": "Live INR forex rates USD/GBP/EUR/AED/SAR — ECB free"},
        ],
        "Company Registry": [
            {"name": "MCA_COMPANY", "description": "MCA21 company search — CIN validation"},
        ],
        "Banking & Address": [
            {"name": "IFSC",    "description": "IFSC bank branch verification — RBI registry via Razorpay"},
            {"name": "PINCODE", "description": "India Post pincode — district, state, post offices"},
        ],
    }
    # Flat list for frontend
    chains_flat = [c for dept in departments.values() for c in dept]
    return {
        "total_chains": len(CHAIN_MAP),
        "chains": chains_flat,
        "departments": departments,
        "api_keys_status": {
            "RAPIDAPI_KEY": "✅ set" if os.getenv("RAPIDAPI_KEY") else "❌ not set",
            "API_SETU_KEY": "✅ set" if os.getenv("API_SETU_KEY") else "❌ not set",
            "NSE_INDIA":    "✅ live — no key needed",
            "FOREX":        "✅ live — no key needed",
            "IFSC":         "✅ live — no key needed",
            "PINCODE":      "✅ live — no key needed",
        },
    }


# ─── Watch mode ────────────────────────────────────────────────────────────────

@router.post("/watch/start")
async def start_watch():
    return watcher.start()


@router.post("/watch/stop")
async def stop_watch():
    return watcher.stop()


@router.post("/watch")
async def add_watch(request: WatchRequest):
    if not request.party_name and not request.case_number:
        raise HTTPException(status_code=400, detail="Provide party_name or case_number")
    return watcher.add_watch(
        party_name=request.party_name, case_number=request.case_number,
        phone=request.phone, notes=request.notes,
    )


@router.get("/watch")
async def list_watches():
    watches = watcher.list_watches()
    return {"total": len(watches), "watches": watches}


@router.delete("/watch/{watch_id}")
async def remove_watch(watch_id: str):
    return watcher.remove_watch(watch_id)


# ─── Alerts ────────────────────────────────────────────────────────────────────

@router.post("/alert")
async def send_alert(request: AlertRequest):
    return send_whatsapp_alert(message=request.message, to=request.phone, alert_type=request.alert_type)


@router.post("/alert/hearing")
async def hearing_reminder(request: HearingReminderRequest):
    return send_hearing_reminder(
        case_number=request.case_number, court=request.court,
        date=request.date, party=request.party, to=request.phone,
    )


# ─── Sandbox ping ──────────────────────────────────────────────────────────────

@router.get("/sandbox/ping")
async def sandbox_ping():
    import requests, uuid
    from datetime import datetime, timedelta

    key       = os.getenv("API_SETU_KEY", "demokey123456ABCD789")
    client_id = os.getenv("API_SETU_CLIENT_ID", "in.gov.sandbox")
    base      = "https://sandbox.api-setu.in"
    headers   = {"X-APISETU-APIKEY": key, "X-APISETU-CLIENTID": client_id, "Content-Type": "application/json"}
    now       = datetime.utcnow()
    results   = {}
    endpoints = {
        "mee_seva_tg_incer":  f"{base}/certificate/v3/meesevatg/incer",
        "transport_ts_drvlc": f"{base}/certificate/v3/transportts/drvlc",
    }
    for name, url in endpoints.items():
        try:
            resp = requests.post(url, headers=headers, json={}, timeout=8)
            results[name] = {"reachable": True, "http_status": resp.status_code}
        except Exception as e:
            results[name] = {"reachable": False, "error": str(e)}
    return {"sandbox_url": base, "endpoints": results}


# ─── Templates ─────────────────────────────────────────────────────────────────

LEGAL_TEMPLATES = [
    {"id": "cheque_bounce_notice",    "title": "Cheque Bounce Legal Notice",     "law": "NI Act S.138",            "category": "Criminal",  "desc": "Statutory demand notice for dishonoured cheque."},
    {"id": "bail_application",        "title": "Bail Application",               "law": "CrPC S.437",              "category": "Criminal",  "desc": "Regular bail before Magistrate."},
    {"id": "anticipatory_bail",       "title": "Anticipatory Bail",              "law": "CrPC S.438",              "category": "Criminal",  "desc": "Pre-arrest bail from Sessions Court / HC."},
    {"id": "criminal_complaint",      "title": "Criminal Complaint / FIR",       "law": "CrPC S.154/200",          "category": "Criminal",  "desc": "Complaint to Magistrate or police."},
    {"id": "revision_petition",       "title": "Revision Petition",              "law": "CrPC S.397",              "category": "Criminal",  "desc": "Revision against subordinate criminal court order."},
    {"id": "rent_eviction",           "title": "Rent Eviction Notice",           "law": "TS Buildings (Rent) Act", "category": "Civil",     "desc": "Eviction notice for rent arrears or breach."},
    {"id": "money_recovery",          "title": "Money Recovery Suit",            "law": "CPC Order 37",            "category": "Civil",     "desc": "Summary suit for recovery of money."},
    {"id": "injunction",              "title": "Injunction Application",         "law": "CPC Order 39 R.1-2",      "category": "Civil",     "desc": "Interim injunction to restrain defendant."},
    {"id": "property_plaint",         "title": "Property Dispute Plaint",        "law": "CPC S.26 / Order 7",      "category": "Civil",     "desc": "Suit for declaration, possession, or partition."},
    {"id": "appeal_memo",             "title": "Appeal Memo",                    "law": "CPC S.96 / CrPC S.374",   "category": "Civil",     "desc": "Memorandum of appeal against decree."},
    {"id": "consumer_complaint",      "title": "Consumer Complaint",             "law": "COPRA 2019",              "category": "Consumer",  "desc": "Complaint before Consumer Commission."},
    {"id": "insurance_complaint",     "title": "Insurance Claim Complaint",      "law": "IRDAI Act",               "category": "Consumer",  "desc": "Complaint for wrongful claim rejection."},
    {"id": "divorce_petition",        "title": "Divorce Petition",               "law": "HMA S.13",                "category": "Family",    "desc": "Petition for divorce on statutory grounds."},
    {"id": "maintenance_application", "title": "Maintenance Application",        "law": "HMA S.24 / CrPC S.125",   "category": "Family",    "desc": "Application for interim or permanent maintenance."},
    {"id": "child_custody",           "title": "Child Custody Petition",         "law": "Guardians & Wards Act",   "category": "Family",    "desc": "Petition for custody of minor child."},
    {"id": "gst_dispute_reply",       "title": "GST Dispute Reply",              "law": "CGST Act 2017",           "category": "Tax",       "desc": "Reply to GST Show Cause Notice."},
    {"id": "income_tax_appeal",       "title": "Income Tax Appeal",              "law": "IT Act S.246A",           "category": "Tax",       "desc": "Appeal before CIT(A)."},
    {"id": "nclt_insolvency",         "title": "NCLT Insolvency Petition",       "law": "IBC 2016 S.7/9",          "category": "Corporate", "desc": "Petition under IBC by financial/operational creditor."},
    {"id": "company_petition",        "title": "Company Law Petition",           "law": "Companies Act 2013",      "category": "Corporate", "desc": "Petition for oppression, mismanagement, winding up."},
    {"id": "sale_agreement",          "title": "Property Sale Agreement",        "law": "Transfer of Property Act","category": "Property",  "desc": "Agreement for sale/purchase of immovable property."},
    {"id": "power_of_attorney",       "title": "Power of Attorney (General)",    "law": "Powers of Attorney Act",  "category": "Property",  "desc": "Authorising agent for property matters."},
    {"id": "leave_license",           "title": "Leave & License Agreement",      "law": "TS Rent Act",             "category": "Property",  "desc": "Temporary licensed occupation of premises."},
    {"id": "partnership_deed",        "title": "Partnership Deed",               "law": "Indian Partnership Act",  "category": "Property",  "desc": "Deed constituting a partnership firm."},
    {"id": "rti_application",         "title": "RTI Application",                "law": "RTI Act 2005 S.6",        "category": "Other",     "desc": "Application for information from public authority."},
    {"id": "vakalathnama",            "title": "Vakalathnama",                   "law": "Advocates Act 1961",      "category": "Other",     "desc": "Power to plead given to advocate in court."},
    {"id": "writ_petition",           "title": "Writ Petition",                  "law": "Art. 226 / 32 Const.",    "category": "Other",     "desc": "Petition before HC/SC for enforcement of rights."},
    {"id": "mact_petition",           "title": "Motor Accident Claim",           "law": "MV Act 1988 S.166",       "category": "Other",     "desc": "Claim petition before MACT."},
    {"id": "legal_notice_general",    "title": "Legal Notice (General)",         "law": "Limitation Act",          "category": "Civil",     "desc": "Formal legal notice for any civil demand."},
]


@router.get("/templates")
async def list_templates(category: Optional[str] = None):
    templates = LEGAL_TEMPLATES
    if category and category.lower() != "all":
        templates = [t for t in templates if t["category"].lower() == category.lower()]
    return {"total": len(templates), "templates": templates}


# ─── AI Drafting ────────────────────────────────────────────────────────────────

@router.post("/draft")
async def draft_document(req: DraftRequest, current_user: Optional[dict] = Depends(get_current_user)):
    template = next((t for t in LEGAL_TEMPLATES if t["id"] == req.template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{req.template_id}' not found")

    from ai_brain import _call_claude, _call_openai, _call_gemini, _init_providers, get_active_providers
    _init_providers()
    active = get_active_providers()

    system = """You are a senior Indian advocate drafting a formal legal document.

Write a complete, court-ready legal document based on the template and variables provided.
- Use proper legal formatting and language
- Include all relevant Indian law citations, section numbers, and case references
- Address the document to the correct court/authority
- Include proper cause title, prayer, and advocate signature block
- Use formal Indian legal drafting conventions (Honourable Court, Respectfully submitted, etc.)
- The document must be complete and ready to file — no placeholders"""

    vars_text = "\n".join(f"- {k.replace('_', ' ').title()}: {v}" for k, v in req.variables.items())
    user_prompt = f"""Draft a complete {template['title']} under {template['law']}.

Template Details:
{template['desc']}

Provided Information:
{vars_text}

{f'Additional Instructions: {req.custom_instructions}' if req.custom_instructions else ''}

Write the complete legal document now."""

    draft = None
    if "claude" in active:
        draft = _call_claude(system, user_prompt, temperature=0.2, max_tokens=4000)
    if not draft and "openai" in active:
        draft = _call_openai(system, user_prompt, temperature=0.2, max_tokens=4000)
    if not draft and "gemini" in active:
        draft = _call_gemini(system, user_prompt, temperature=0.2, max_tokens=4000)

    if not draft:
        vars_list = "\n".join(f"  {k.replace('_', ' ').title()}: {v}" for k, v in req.variables.items())
        draft = f"""[AI DRAFT — {template['title']} | {template['law']}]

{"="*60}

IN THE ________________________________
(Appropriate Court / Authority)

SUBJECT: {template['title'].upper()}

PARTIES:
{vars_list}

RESPECTFULLY SUBMITTED:

This document is filed under {template['law']} and sets forth the following:

[AI providers temporarily unavailable. Please retry in a moment, or use the Forge for full legal strategy.]

Submitted by,
Advocate for the Petitioner/Complainant
Bar Council Registration No.: ___________
Date: {__import__('datetime').date.today().strftime('%d-%m-%Y')}"""

    return {
        "draft": draft,
        "template": template,
        "ai_provider": active[0] if active else "template",
    }


# ─── Legal Research ─────────────────────────────────────────────────────────────

@router.post("/research")
async def legal_research(req: ResearchRequest, current_user: Optional[dict] = Depends(get_current_user)):
    from ai_brain import _call_claude, _call_openai, _call_gemini, _init_providers, get_active_providers
    _init_providers()
    active = get_active_providers()

    system = f"""You are a senior Indian legal researcher specialising in {req.jurisdiction} courts, with encyclopaedic knowledge of Indian statutes and Supreme Court / High Court judgments.

Answer the legal research query with:
1. A clear, authoritative answer (2-4 paragraphs)
2. Exact citations of landmark cases (case name, year, AIR/SCC/SCR citation where possible)
3. Relevant statute sections with precise sub-section numbers
4. Practical implication for an advocate in {req.jurisdiction}

Format your response as:
ANSWER:
[your legal analysis]

KEY STATUTES:
[bullet list of statute sections, one per line, format: "Act Name, Section X — description"]

CITATIONS:
[numbered list of case citations, format: "Case Name v. Case Name (Year) Volume AIR/SCC page"]

Be precise, cite only real Indian cases and statutes. If unsure of a citation, omit it."""

    answer_text = None
    if "claude" in active:
        answer_text = _call_claude(system, f"Research query: {req.query}\nJurisdiction: {req.jurisdiction}", temperature=0.2, max_tokens=3000)
    if not answer_text and "openai" in active:
        answer_text = _call_openai(system, f"Research query: {req.query}\nJurisdiction: {req.jurisdiction}", temperature=0.2, max_tokens=3000)
    if not answer_text and "gemini" in active:
        answer_text = _call_gemini(system, f"Research query: {req.query}\nJurisdiction: {req.jurisdiction}", temperature=0.2, max_tokens=3000)

    if not answer_text:
        return {
            "answer": f"AI research providers are temporarily unavailable. Please use the Forge for comprehensive legal analysis on: {req.query}",
            "citations": [],
            "key_statutes": [],
            "jurisdiction": req.jurisdiction,
        }

    import re as _re
    answer_part = ""
    statutes = []
    citations = []

    answer_match = _re.search(r'ANSWER:\s*(.*?)(?=KEY STATUTES:|CITATIONS:|$)', answer_text, _re.DOTALL)
    if answer_match:
        answer_part = answer_match.group(1).strip()
    else:
        answer_part = answer_text

    statutes_match = _re.search(r'KEY STATUTES:\s*(.*?)(?=CITATIONS:|$)', answer_text, _re.DOTALL)
    if statutes_match:
        statutes = [s.strip().lstrip("•-* ") for s in statutes_match.group(1).strip().split("\n") if s.strip() and len(s.strip()) > 5]

    citations_match = _re.search(r'CITATIONS:\s*(.*?)$', answer_text, _re.DOTALL)
    if citations_match:
        citations = [c.strip().lstrip("0123456789. ") for c in citations_match.group(1).strip().split("\n") if c.strip() and len(c.strip()) > 5]

    return {
        "answer": answer_part or answer_text,
        "citations": citations[:8],
        "key_statutes": statutes[:6],
        "jurisdiction": req.jurisdiction,
    }


# ─── Mount ─────────────────────────────────────────────────────────────────────

app.include_router(router, prefix=BASE_PATH)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        root_path=BASE_PATH,
        reload=os.getenv("RELOAD", "false").lower() == "true",
    )
