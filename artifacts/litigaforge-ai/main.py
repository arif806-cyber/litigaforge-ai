"""
LitigaForge AI — FastAPI Server
Full REST API for legal case forging, watch mode, forge memory, and WhatsApp alerts.
Supports a configurable BASE_PATH prefix for reverse-proxy deployments.
"""
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("litigaforge.api")

from litigaforge_engine import forge_case, memory
from alerts.whatsapp import send_whatsapp_alert, send_hearing_reminder
from watch_mode import WatchModeManager

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
    version="2.0.0",
    lifespan=lifespan,
    root_path=BASE_PATH,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

router = APIRouter()


# ─── Models ───────────────────────────────────────────────────────────────────

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


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
async def root():
    docs_path = f"{BASE_PATH}/docs" if BASE_PATH else "/docs"
    return {
        "name": "LitigaForge AI",
        "version": "2.0.0",
        "status": "running",
        "watch_mode_active": watcher.is_running,
        "forge_memory": memory.stats(),
        "docs": docs_path,
        "endpoints": {
            f"POST {BASE_PATH}/forge": "Forge a legal strategy from a natural-language prompt",
            f"GET  {BASE_PATH}/cases": "List recent forged cases",
            f"GET  {BASE_PATH}/cases/{{case_id}}": "Retrieve a specific case",
            f"GET  {BASE_PATH}/memory/patterns": "View all learned forge patterns",
            f"GET  {BASE_PATH}/chains": "List all available API chains",
            f"POST {BASE_PATH}/watch": "Add a case to Watch Mode",
            f"GET  {BASE_PATH}/watch": "List active watches",
            f"DELETE {BASE_PATH}/watch/{{watch_id}}": "Deactivate a watch",
            f"POST {BASE_PATH}/watch/start": "Start Watch Mode scheduler",
            f"POST {BASE_PATH}/watch/stop": "Stop Watch Mode scheduler",
            f"POST {BASE_PATH}/alert": "Send a WhatsApp alert",
            f"POST {BASE_PATH}/alert/hearing": "Send a hearing reminder",
        },
    }


@router.get("/healthz")
async def health():
    return {"status": "ok", "service": "LitigaForge AI", "dummy_mode": not os.getenv("OPENAI_API_KEY")}


@router.post("/forge")
async def forge(request: ForgeRequest, background_tasks: BackgroundTasks):
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    try:
        result = forge_case(request.prompt)
    except Exception as e:
        logger.exception("Engine error")
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")

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
    return {
        "total_chains": len(CHAIN_MAP),
        "chains": [
            {"name": "GSTIN",        "description": "GST registration status, filing history, taxpayer details"},
            {"name": "PAN",          "description": "PAN verification, name match, Aadhaar seeding status"},
            {"name": "DigiLocker",   "description": "Aadhaar, income, domicile certificates via API Setu"},
            {"name": "eCourts",      "description": "Case search by party name or case number — all Indian courts"},
            {"name": "VAHAN",        "description": "Vehicle RC, owner, insurance, fitness, tax validity"},
            {"name": "SARATHI",      "description": "Driving licence holder, validity, vehicle classes"},
            {"name": "BPCL_LPG",     "description": "LPG Subscription Voucher — Ministry of Petroleum (BPCL)"},
            {"name": "MERIPEHCHAAN", "description": "DigiLocker OAuth2 SSO — all citizen documents (NIC/MeitY)"},
            {"name": "MEE_SEVA_TG",  "description": "Mee Seva Telangana — 11 state certificates via API Setu"},
            {"name": "TRANSPORT_TS", "description": "Telangana Transport Dept — DL & RC via Parivahan/API Setu"},
        ],
        "note": "Live sandbox mode active (sandbox.api-setu.in). Set MEESEVA_USE_PROD=true + production API_SETU_KEY for real citizen data." if os.getenv("API_SETU_KEY") else "Set API_SETU_KEY to enable live sandbox calls via API Setu.",
    }


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


@router.post("/alert")
async def send_alert(request: AlertRequest):
    return send_whatsapp_alert(message=request.message, to=request.phone, alert_type=request.alert_type)


@router.post("/alert/hearing")
async def hearing_reminder(request: HearingReminderRequest):
    return send_hearing_reminder(
        case_number=request.case_number, court=request.court,
        date=request.date, party=request.party, to=request.phone,
    )


# Mount router at BASE_PATH (e.g. /litigaforge) or at root if no prefix
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
