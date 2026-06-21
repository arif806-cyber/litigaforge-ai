"""
WebSocket presence — lets clients see when a lawyer is actively reviewing their case.

Endpoints:
  WS  /ws/cases/{case_id}          — client subscribes (no auth needed)
  POST /cases/{case_id}/track-view  — lawyer fires when opening a case
"""
import json
import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from auth import get_current_user

logger = logging.getLogger("litigaforge.presence")
router = APIRouter(tags=["presence"])


class ConnectionManager:
    def __init__(self) -> None:
        self._conns: Dict[int, List[WebSocket]] = {}

    async def connect(self, case_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._conns.setdefault(case_id, []).append(ws)

    def disconnect(self, case_id: int, ws: WebSocket) -> None:
        bucket = self._conns.get(case_id, [])
        try:
            bucket.remove(ws)
        except ValueError:
            pass
        if not bucket:
            self._conns.pop(case_id, None)

    async def broadcast(self, case_id: int, data: dict) -> None:
        bucket = list(self._conns.get(case_id, []))
        dead: List[WebSocket] = []
        for ws in bucket:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(case_id, ws)


manager = ConnectionManager()


@router.websocket("/ws/cases/{case_id}")
async def case_presence_ws(case_id: int, ws: WebSocket):
    """Client subscribes here to receive lawyer-viewing events for their case."""
    await manager.connect(case_id, ws)
    try:
        while True:
            await ws.receive_text()  # absorb pings; ignore payload
    except WebSocketDisconnect:
        manager.disconnect(case_id, ws)
    except Exception:
        manager.disconnect(case_id, ws)


@router.post("/cases/{case_id}/track-view")
async def track_lawyer_view(
    case_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Lawyer fires this when they open a case detail; broadcasts presence to subscribers."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    await manager.broadcast(
        case_id,
        {"event": "lawyer_viewing", "lawyer_id": current_user["id"]},
    )
    logger.debug("lawyer %s viewing case %s broadcast sent", current_user["id"], case_id)
    return {"status": "ok"}
