---
name: LitigaForge auth init + PWA service-worker gotchas
description: Cookie-only auth refresh contract for the initial /auth/me probe, and why a stale VitePWA service worker masks source/build changes in the preview browser.
---

# Auth is cookie-only; the localStorage `lf_token` is only a "logged-in-on-this-browser" flag

- The real auth is an httpOnly cookie set by the backend. `apiFetch` and the auth-context probe both send `credentials: "include"` and do NOT attach a Bearer token. `lf_token` in `localStorage` is just a hint that this browser has logged in. Every login path (`login`/`register`/`google`/`apple`/`passkey`) sets it; `logout` removes it.

**Why:** intentional security choice — do not "fix" the probe by adding `Authorization: Bearer` from localStorage.

# The initial `/auth/me` probe must (a) skip when there's no token, and (b) refresh-then-retry on 401 before logging out

- `AuthProvider` renders a full-screen spinner until the initial probe resolves, so the probe is on the critical first-paint path. For anonymous visitors (no `lf_token`) — the homepage / Lighthouse case — skip `/auth/me` entirely: render immediately and emit no console 401.
- Access token is short-lived (~15 min) but the refresh cookie lasts ~30 days. So a 401 from `/auth/me` does NOT mean "logged out" — it usually means the access cookie just expired. The probe must mirror `apiFetch`: on 401 call `_tryRefresh()` (POST `/auth/refresh`, exported from `src/lib/api.ts`) and retry `/auth/me` once. Only if the refresh also fails is the session truly gone — then drop the stale `lf_token` so future loads skip the probe. Never remove the token (or sign the user out) on a *network* error, only on a real 401.

**Why:** without refresh-on-401 the probe bounces a genuinely-logged-in user to a logged-out state on any cold reload >15 min after sign-in; removing the token without refreshing makes that logout sticky. The same pre-existing exposure lives in `lawyer-dashboard`'s periodic `refreshUser()` poll.

# A stale VitePWA service worker masks source/build changes in the preview browser

- `vite.config.ts` uses `VitePWA({ registerType: "autoUpdate", devOptions: { enabled: false }, workbox: { runtimeCaching: NetworkFirst for /litigaforge/ } })`. `devOptions.enabled:false` means the vite dev server registers NO service worker — but a service worker registered during a PRIOR production load (when the Node api-server served the built dist) persists in the browser profile and keeps serving the cached app shell + old JS. It can only auto-update when the production server hands back a fresh `sw.js`, so while `artifacts/api-server` is down it never updates and the preview shows stale behavior (e.g. an old `/auth/me` 401 that the new code no longer triggers).

**Why / how to apply:** do NOT trust the in-workspace preview browser to reflect UI source changes — verify the change landed in the BUILT bundle instead (`grep` the minified `dist/public/assets/index-*.js` for the new logic), and run Lighthouse/PageSpeed in a clean/incognito profile (no prior SW). A real first-time visitor has no SW and gets fresh code immediately; returning users self-heal via `autoUpdate` + `cleanupOutdatedCaches` on the next deploy.
