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
from extra_routes import router as extra_router

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
    try:
        user = create_user(
            email=req.email,
            name=req.name,
            password_hash=hash_password(req.password),
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

    return {
        "status": "success",
        "case_id": result["case_id"],
        "chains_executed": result["planned_chains"],
        "chain_map": result["chain_map"],
        "entities_found": result["extracted_entities"],
        "api_results": result["api_results"],
        "meta_suggestions": result["meta_suggestions"],
        "final_output": result["final_output"],
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


# ─── Mount ─────────────────────────────────────────────────────────────────────

app.include_router(router, prefix=BASE_PATH)
app.include_router(extra_router, prefix=BASE_PATH)

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
