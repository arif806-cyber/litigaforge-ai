---
name: LitigaForge presence WebSocket
description: Architecture and gotchas for the lawyer-viewing presence system built on FastAPI WebSockets.
---

# LitigaForge presence WebSocket

## The system
- `routers/presence.py` — `ConnectionManager` (dict of `case_id → List[WebSocket]`), WS endpoint `GET /ws/cases/{case_id}`, POST `POST /cases/{case_id}/track-view` (auth-required).
- Registered in `main.py` with `prefix=BASE_PATH` → full path `/litigaforge/ws/cases/{id}`.
- Client hook: `useLawyerPresence(caseId)` in `src/hooks/useLawyerPresence.ts`.
- UI: `LawyerMatchCard` reads `isReviewing` prop, shows green dot + "Reviewing your case now…".

## Key decisions

**WS URL construction — no env var needed:**
```ts
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const url = `${protocol}//${window.location.host}/litigaforge/ws/cases/${caseId}`;
```
Works in dev (through port-80 proxy) and prod without any VITE_WS_URL setting.
**Why:** Replit's shared proxy forwards WS upgrades on the same host/port as HTTP. An env var would be wrong for prod and annoying to maintain.

**React hook ordering in matches.tsx:**
`useLawyerPresence` MUST be called AFTER the `useQuery` that fetches `clientMatches`. The `const matches = clientMatches?.matches ?? []` derivation must also come before the hook so `presenceCaseId` is valid. Placing the hook before the query caused TS2448 ("used before declaration").

**15 s expiry per lawyer, reset on each broadcast:**
Each `lawyer_viewing` event resets that lawyer's expiry timer. The client cleans up with a Map of timers; all timers cleared on unmount.

**Missing half of the loop:**
The lawyer side never fires `POST /cases/{id}/track-view` yet. The endpoint exists and works (returns 401 when unauthenticated). Wire it in `lawyer-dashboard.tsx` when they open a match detail — use `match.case_requirement_id` as the case_id.

**FastAPI WS + include_router prefix:**
`@router.websocket("/ws/cases/{case_id}")` with `include_router(presence_router, prefix=BASE_PATH)` correctly yields `/litigaforge/ws/cases/{id}`. FastAPI handles WS routes in APIRouter the same as HTTP routes.

**No `from __future__ import annotations` in presence.py:**
Per the slowapi gotcha — don't add it to any new router files.
