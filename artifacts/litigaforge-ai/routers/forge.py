"""
LitigaForge AI — Forge Router
Case forging, memory, chains, root, and health endpoints.
"""
import os
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

from litigaforge_engine import forge_case, memory
from alerts.whatsapp import send_whatsapp_alert
from database import increment_case_count, TIER_LIMITS
from auth import get_current_user
from rate_limit import limiter

router = APIRouter(tags=["forge"])
BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")


class ForgeRequest(BaseModel):
    prompt: str
    notify_whatsapp: bool = False
    advocate_phone: Optional[str] = None


@router.get("/")
async def root():
    docs_path = f"{BASE_PATH}/docs" if BASE_PATH else "/docs"
    return {
        "name": "LitigaForge AI",
        "version": "3.0.0",
        "status": "running",
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


@router.post("/forge")
@limiter.limit("10/minute")
async def forge(request: ForgeRequest, background_tasks: BackgroundTasks,
                fastapi_request: Request,
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
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")

    # Increment counter for authenticated users
    if current_user:
        try:
            await increment_case_count(current_user["id"])
        except Exception:
            pass

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
    chains_flat = [c for dept in departments.values() for c in dept]
    return {
        "total_chains": len(CHAIN_MAP),
        "chains": chains_flat,
        "departments": departments,
        "api_keys_status": {
            "RAPIDAPI_KEY":  "✅ set" if os.getenv("RAPIDAPI_KEY") else "❌ not set",
            "API_SETU_KEY":  "✅ set" if os.getenv("API_SETU_KEY") else "❌ not set",
            "ECOURTS_API_KEY": "✅ live" if os.getenv("ECOURTS_API_KEY") else "❌ not set",
            "NSE_INDIA":     "✅ live — no key needed",
            "FOREX":         "✅ live — no key needed",
            "IFSC":          "✅ live — no key needed",
            "PINCODE":       "✅ live — no key needed",
        },
    }


@router.get("/sandbox/ping")
async def sandbox_ping():
    import requests
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
