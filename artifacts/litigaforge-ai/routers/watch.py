"""
LitigaForge AI — Watch Router
Simple in-memory case watch list (no external dependencies).
"""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["watch"])

_watches: dict[str, dict] = {}
_running = False


class WatchRequest(BaseModel):
    party_name: Optional[str] = None
    case_number: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = ""


@router.post("/watch/start")
async def start_watch():
    global _running
    _running = True
    return {"status": "started", "message": "Watch mode active"}


@router.post("/watch/stop")
async def stop_watch():
    global _running
    _running = False
    return {"status": "stopped", "message": "Watch mode stopped"}


@router.post("/watch")
async def add_watch(request: WatchRequest):
    if not request.party_name and not request.case_number:
        raise HTTPException(status_code=400, detail="Provide party_name or case_number")
    watch_id = str(uuid.uuid4())[:8]
    _watches[watch_id] = {
        "id": watch_id,
        "party_name": request.party_name,
        "case_number": request.case_number,
        "phone": request.phone,
        "notes": request.notes,
    }
    return {"status": "added", "watch_id": watch_id}


@router.get("/watch")
async def list_watches():
    watches = list(_watches.values())
    return {"total": len(watches), "watches": watches}


@router.delete("/watch/{watch_id}")
async def remove_watch(watch_id: str):
    if watch_id not in _watches:
        raise HTTPException(status_code=404, detail="Watch not found")
    del _watches[watch_id]
    return {"status": "removed", "watch_id": watch_id}
