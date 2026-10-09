---
name: LitigaForge auth init + PWA service-worker gotchas
description: Cookie-only auth refresh contract for the initial /auth/me probe, and why a stale VitePWA service worker masks source/build changes in the preview browser.
---

# Browser auth is strictly cookie-only

- The real auth is an httpOnly cookie set by the backend. Browser code must not store an access JWT or login sentinel in localStorage and must not send `Authorization: Bearer`. API calls and the auth-context probe send `credentials: "include"`.

**Why:** a browser-held JWT defeats the XSS protection provided by httpOnly cookies. A real-browser registration/reload test confirmed cookie-only session persistence without local/session storage tokens.

# Confirm the app's production database before acting on a frozen DB

- A `.neon.tech` host alone does not distinguish user-managed Neon from Replit-managed Postgres. A frozen Replit database may explain login 500s, and a duplicate `DATABASE_URL` secret can override the runtime-managed value and hide **Unpause**. If the Database tool says the account has PostgreSQL restrictions, only Replit Support can clear that account-level block; don't keep changing URLs or code.

**Why:** Replit-managed Postgres can use Neon-hosted endpoints, while this app can also be configured for an external PostgreSQL connection; confusing the two can disconnect production.

**How to apply:** inspect only secret existence/scope and the app's configured provider, never print the URL. If a database credential is disclosed in chat, treat it as compromised and tell the user to regenerate it in the Database tool when Replit-managed, or rotate it with the external provider; never store the replacement in project memory. For an account-restriction banner, give support the project URL and request review/unpause.

# The initial `/auth/me` probe must refresh-then-retry on 401 before logging out

- Access tokens are short-lived but refresh cookies last longer. A 401 from `/auth/me` does not necessarily mean "logged out": call `/auth/refresh` and retry `/auth/me` once. Only if refresh fails is the session truly gone. Network errors must not be treated as logout.

**Why:** without refresh-on-401, a genuinely logged-in user is bounced to logged-out state after the short-lived access cookie expires.

# Every API 401 gets one silent refresh attempt

- `apiFetch` must attempt one silent refresh and retry after every 401. The public-path allowlist only controls whether a failed refresh redirects to login; it must never suppress the refresh attempt. Protected AI submissions, clarification, document generation/analysis, and owned job polling all rely on this.

**Why:** Classifying clarification, the document analyzer, or job polling as public caused an expired 15-minute access cookie to surface as an authentication error even while the valid refresh cookie was still present. Access rules can change while frontend allowlists become stale.

**How to apply:** Keep the public list accurate for redirect behavior, but never gate refresh attempts on it. Anonymous endpoints normally do not return 401, so the universal refresh attempt is harmless for valid public requests.

# Legacy accounts predate email verification

Accounts created before the email-verification launch at 2026-06-06 06:33:35 UTC are grandfathered as verified. Accounts created on or after that cutoff remain unverified until they complete the email-link flow.

**Why:** Older accounts were assigned `email_verified = false` when the column was introduced even though no verification flow existed when they registered. Blocking them from case posting and advocate onboarding was therefore impossible for them to prevent.

**How to apply:** Keep the cutoff migration idempotent and restricted to the pre-launch cohort. Never broaden it to new registrations or disable verification checks on protected submissions.

# A stale VitePWA service worker masks source/build changes in the preview browser

- `devOptions.enabled:false` means the Vite dev server registers NO service worker, but a worker from a prior built-app load persists in the browser profile. It updates only when the Node frontend server provides a fresh `sw.js`, so source changes can appear stale while that server is down.

**Why / how to apply:** do not trust the preview to reflect UI source changes until the production bundle is rebuilt and the Node frontend workflow restarted.

# VitePWA updates must reload already-open clients

- `injectRegister: "auto"` emits a bare `navigator.serviceWorker.register(...)` script; `autoUpdate`, `skipWaiting`, and `clientsClaim` alone do not replace JavaScript already running in an open tab. For reliable version transitions, register the worker explicitly with a per-build query version and `updateViaCache: "none"`, then reload once on `controllerchange` only when a worker already controlled the page. Keep Vite's hashed assets and `cleanupOutdatedCaches`.

**Why:** a new worker can take control while an existing page continues executing an old bundle, so a server-side publish or hard reload is not enough to prove that the page's JavaScript changed.

**How to apply:** after PWA changes, rebuild with the correct base path, verify the generated worker still has `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`, and the navigation denylist, and confirm no API runtime cache was added.

# API traffic must never use service-worker runtime caching

- Never add Workbox runtime-caching rules for `/litigaforge` or `/api`. The navigation denylist for both prefixes stays required, but it solves a separate problem.

**Why:** A `NetworkFirst` API rule with a timeout killed long-job status polling and could return stale job states, so completed AI results never rendered even though the backend succeeded.

**How to apply:** Runtime caching is allowed for static third-party assets such as fonts only. After every PWA config change, build with the correct base path and inspect generated `sw.js` for no API cache/timeout while retaining the navigation denylist, `skipWaiting`, and `clientsClaim`.

# Every backend/proxied path prefix MUST be in `navigateFallbackDenylist`

- The SW's navigation fallback serves the precached React `index.html` for ALL in-scope navigations EXCEPT denylisted ones. Any backend or reverse-proxied URL that a user might open directly in the browser must be denylisted, or the SW hands back the SPA shell, the app prepends the country prefix (e.g. `/api/llm/health` → `/in/api/llm/health`) and renders its own "404 - Not Found" — even though `curl` (no SW) returns the correct JSON. The denylist must cover `/blog`, `/_astro`, `/api`, AND `/litigaforge`.
- Symptom signature: address bar shows the URL with a `/in/` (or other country) prefix it didn't have when typed, plus the in-app 404 card. That country-prefix reappearing is the tell that the React app loaded (SW served the shell) instead of the request reaching the backend.

**Why:** Runtime caching governs fetch/XHR sub-resources, while top-level navigations are decided by the navigation route and its denylist. The denylist must remain even though API runtime caching is prohibited.

# Admin = `is_superuser` flag; grant it on prod via a deploy-time bootstrap, not direct DB writes

- There is no separate admin login and no seeded admin account. Admin access is a normal user row with `is_superuser = TRUE`; `get_superuser` (403 gate) protects every `/admin/*` endpoint and there is no self-promotion route. Passwords are bcrypt — never recoverable.
- Dev and production are SEPARATE databases (dev had ~80 users / several admins while prod had 13 users / **zero** admins). Promoting an admin in dev does nothing for the live site.
- The agent's `executeSql(environment:"production")` is READ-ONLY, so you cannot UPDATE the prod row directly. The working pattern: an idempotent "admin bootstrap" in the FastAPI lifespan that reads `ADMIN_EMAILS` (comma-separated, shared env var), lowercases/trims, and `UPDATE users SET is_superuser=TRUE WHERE lower(email)=ANY($1::text[]) AND is_superuser IS DISTINCT FROM TRUE`. It runs on the production app's own startup, so it only takes effect after a redeploy/publish.
- **Promotion is one-way:** removing an email from `ADMIN_EMAILS` does NOT demote. Revocation requires a manual DB update. (Chosen deliberately to avoid accidental lockout on env churn.)

**Why:** the prod DB can't be written from agent tooling and there's no in-app self-promote, so the only safe, repeatable way to grant the first admin on the live site is a parameterized, idempotent startup bootstrap keyed on a shared env var + a redeploy. Do NOT reuse this pattern for emails of accounts that don't yet exist / aren't verified (squatting risk); it's safe here only because the target email is already registered to the owner under a UNIQUE constraint.

# Break-glass admin password reset (no SMTP): set a secret, redeploy once, then DELETE it

- When the admin forgot their password and SMTP/email reset isn't configured, the working recovery is a one-time reset in the same lifespan: read the `ADMIN_RESET_PASSWORD` secret; if set (and `ADMIN_EMAILS` set), `UPDATE users SET password_hash = <bcrypt> WHERE lower(email)=ANY(ADMIN_EMAILS)`. Hash with the app's own `auth.hash_password` (do NOT hand-roll bcrypt — match the verify path). Never log the password (count only). Secrets are global, so this also resets the dev DB's matching account (harmless).
- **Deleting the secret afterward is MANDATORY, not hygiene.** Unlike the promotion bootstrap (idempotent, `IS DISTINCT FROM` guard), the reset has NO guard — it re-applies on EVERY restart (dev restart, prod crash-restart, redeploy). If the secret lingers and the user later changes their password in-app, the next restart silently reverts it. Deleting the secret only takes effect on the next process start; the already-applied hash persists in the DB.

**Why:** prod DB is read-only from agent tooling and there's no in-app self-reset, so a startup break-glass keyed on a secret + redeploy is the only path. The missing idempotency guard is intentional (it must re-apply if the stored hash drifts) — which is exactly why the secret must be removed promptly after the user confirms login.

# If you need a known test-account password AND a backend restart (e.g. for an env-var toggle) in the same session, restart FIRST, then set the password

- With `ADMIN_RESET_PASSWORD` still set (agent tooling cannot delete/rotate secrets — only the user can via the env-var request dialog), any backend restart re-applies the break-glass hash and silently reverts a password you just set for e2e testing. If a session needs both (a) a restart for an unrelated env var change and (b) a stable, known password on a superuser test account, do the restart(s) first, confirm the app is in its final state, and only THEN write the known-good password hash directly to that user's row — and do not restart the backend again afterward, or it reverts.

**Why:** discovered while e2e-testing a superuser-only feature — set a test password, restarted the backend for an unrelated `FORGEOS_ENABLED` toggle, and the password silently reverted with no error, wasting a debugging cycle before recalling the break-glass secret was still active.
