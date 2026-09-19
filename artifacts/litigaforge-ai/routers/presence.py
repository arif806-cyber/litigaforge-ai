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
from auth import decode_token, get_current_user

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
        self._conns: Dict[str, List[WebSocket]] = {}

    async def connect(self, channel: str, ws: WebSocket) -> None:
        await ws.accept()
        self._conns.setdefault(channel, []).append(ws)

    def disconnect(self, channel: str, ws: WebSocket) -> None:
        bucket = self._conns.get(channel, [])
        try:
            bucket.remove(ws)
        except ValueError:
            pass
        if not bucket:
            self._conns.pop(channel, None)

    async def broadcast(self, channel: str, data: dict) -> None:
        bucket = list(self._conns.get(channel, []))
        dead: List[WebSocket] = []
        for ws in bucket:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(channel, ws)


manager = ConnectionManager()


# ── WebSocket endpoint ─────────────────────────────────────────────────────────

@router.websocket("/ws/cases/{case_id}")
async def case_presence_ws(case_id: int, ws: WebSocket):
    """Both clients and lawyers subscribe here to receive presence events."""
    channel = f"case:{case_id}"
    await manager.connect(channel, ws)
    try:
        while True:
            await ws.receive_text()  # absorb pings; ignore payload
    except WebSocketDisconnect:
        manager.disconnect(channel, ws)
    except Exception:
        manager.disconnect(channel, ws)


@router.websocket("/ws/messages")
async def message_notifications_ws(ws: WebSocket):
    """Authenticated, user-scoped channel for app-wide chat notifications."""
    token = ws.cookies.get("lf_token")
    if not token:
        await ws.close(code=4001)
        return
    try:
        user_id = decode_token(token)
    except HTTPException:
        await ws.close(code=4001)
        return

    channel = f"user:{user_id}"
    await manager.connect(channel, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(channel, ws)
    except Exception:
        manager.disconnect(channel, ws)


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
        f"case:{case_id}",
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
            f"case:{case_id}",
            {"event": "client_online", "case_id": case_id},
        )
        logger.debug("client user=%s case=%s came online", current_user["id"], case_id)

    return {"status": "ok"}


@router.get("/cases/{case_id}/client-online")
async def is_client_online(case_id: int):
    """Lawyer polls this for the initial online check (no auth needed)."""
    return {"online": _is_client_online(case_id)}
