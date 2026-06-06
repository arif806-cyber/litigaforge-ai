---
name: Apple free services integration
description: 4 Apple services integrated with graceful env-var guards; key py_webauthn API gotcha documented.
---

## Services integrated

| Service | Frontend lib | Env var(s) | Backend |
|---|---|---|---|
| Sign in with Apple | `src/lib/apple-auth.ts` | `VITE_APPLE_CLIENT_ID` | `POST /auth/apple` |
| Passkeys (WebAuthn) | `src/lib/passkeys.ts` | none (browser API) | `routers/passkeys.py` (6 endpoints) |
| Web Push | `src/lib/push.ts` | `VITE_VAPID_PUBLIC_KEY` | `routers/push.py` (4 endpoints) |
| Apple PWA meta | `index.html` | none | — |

## Critical py_webauthn 2.7.1 gotcha

`bytes_to_base64url` is NOT exported from the `webauthn` package top-level.
Only these are exported: `generate_registration_options`, `verify_registration_response`,
`generate_authentication_options`, `verify_authentication_response`, `options_to_json`, `base64url_to_bytes`.

**Fix:** Use `base64.urlsafe_b64encode(data).rstrip(b"=").decode()` directly (stdlib `base64` module).

**Why:** The library exports it internally at `webauthn.helpers.base64url` but not at package level.

## RP ID resolution for Passkeys

The WebAuthn RP ID must match the browser's origin domain. Priority:
1. `REPLIT_DOMAINS` env var (set automatically in Replit — use first domain)
2. `Origin` request header (fallback for dev)
3. `localhost` (last resort)

**Why:** Replit dev preview has a different domain than production; using REPLIT_DOMAINS means
passkeys registered in production work in production, not dev (correct WebAuthn behavior).

## VAPID keys for Web Push

Keys were generated using `py_vapid`. Store as:
- `VAPID_PRIVATE_KEY` → Replit Secret (full PEM string)
- `VITE_VAPID_PUBLIC_KEY` → Replit env var (uncompressed EC point, base64url, no padding)

The public key format needed by browsers is the **uncompressed point** (65 bytes, X962 format),
NOT the PEM/DER form. Generate with:
```python
pub_bytes = key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
pub_b64 = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode()
```

## Graceful degradation

- Apple button: hidden when `VITE_APPLE_CLIENT_ID` unset
- Passkey button: hidden when `!hasPasskeySupport` (old browsers / HTTP in dev)
- Push subscribe: no-ops when `VITE_VAPID_PUBLIC_KEY` unset; backend skips when `VAPID_PRIVATE_KEY` unset
- Web Push on iOS: requires Safari 16.4+ AND site installed to home screen (PWA)
