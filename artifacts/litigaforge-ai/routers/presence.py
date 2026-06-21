"""
WebSocket presence — bidirectional: clients see lawyers reviewing, lawyers see clients online.

Endpoints:
  WS   /ws/cases/{case_id}                — subscribe to presence events (no auth)
  POST /cases/{case_id}/track-view        — lawyer fires on case open (auth required)
  POST /cases/{case_id}/client-heartbeat  — client fires every 20 s (auth required)
  GET  /cases/{case_id}/client-online     — lawyer polls for initial online check (no auth)
"""
import json
import logging
import time
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from auth import get_current_user

logger = logging.getLogger("litigaforge.presence")
router = APIRouter(tags=["presence"])

# ── In-memory client heartbeat store ──────────────────────────────────────────
# Maps case_id → UNIX timestamp of the last heartbeat received from the client.
# No Redis needed: TTL is enforced at read time.  Restarts clear state (fine for
# a presence indicator — worst case a stale dot for <30 s after a deploy).
_client_presence: Dict[int, float] = {}
_CLIENT_TTL = 30.0  # seconds — must heartbeat within this window to stay "online"


def _is_client_online(case_id: int) -> bool:
    ts = _client_presence.get(case_id)
    return ts is not None and (time.time() - ts) < _CLIENT_TTL


# ── WebSocket connection manager ───────────────────────────────────────────────

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


# ── WebSocket endpoint ─────────────────────────────────────────────────────────

@router.websocket("/ws/cases/{case_id}")
async def case_presence_ws(case_id: int, ws: WebSocket):
    """Both clients and lawyers subscribe here to receive presence events."""
    await manager.connect(case_id, ws)
    try:
        while True:
            await ws.receive_text()  # absorb pings; ignore payload
    except WebSocketDisconnect:
        manager.disconnect(case_id, ws)
    except Exception:
        manager.disconnect(case_id, ws)


# ── Lawyer → client direction ──────────────────────────────────────────────────

@router.post("/cases/{case_id}/track-view")
async def track_lawyer_view(
    case_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Lawyer fires this when they open a case; broadcasts presence to subscribers."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    await manager.broadcast(
        case_id,
        {"event": "lawyer_viewing", "lawyer_id": current_user["id"]},
    )
    logger.debug("lawyer %s viewing case %s — broadcast sent", current_user["id"], case_id)
    return {"status": "ok"}


# ── Client → lawyer direction ──────────────────────────────────────────────────

@router.post("/cases/{case_id}/client-heartbeat")
async def client_heartbeat(
    case_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Client fires every 20 s while on the case screen.
    Broadcasts client_online the first time within the TTL window.
    TTL auto-expires on the next read — no explicit offline event needed.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    was_online = _is_client_online(case_id)
    _client_presence[case_id] = time.time()

    if not was_online:
        await manager.broadcast(
            case_id,
            {"event": "client_online", "case_id": case_id},
        )
        logger.debug("client user=%s case=%s came online", current_user["id"], case_id)

    return {"status": "ok"}


@router.get("/cases/{case_id}/client-online")
async def is_client_online(case_id: int):
    """Lawyer polls this for the initial online check (no auth needed)."""
    return {"online": _is_client_online(case_id)}
