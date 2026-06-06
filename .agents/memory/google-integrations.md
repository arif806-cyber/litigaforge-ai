---
name: Google free services integration
description: 5 Google services integrated with graceful env-var guards; maps CSP fix required.
---

## Services integrated

| Service | Frontend lib | Env var(s) | Backend endpoint |
|---|---|---|---|
| GA4 Analytics | `src/lib/analytics.ts` | `VITE_GA4_ID` | — |
| Sign in with Google | `src/lib/google-auth.ts` | `VITE_GOOGLE_CLIENT_ID` | `POST /auth/google` |
| reCAPTCHA v3 | `src/lib/recaptcha.ts` | `VITE_RECAPTCHA_SITE_KEY` | verified in `POST /auth/register` |
| Google Maps (embed) | `legal-aid.tsx` | none needed | — |
| Google OAuth backend | `routers/auth.py` | `GOOGLE_CLIENT_ID`, `RECAPTCHA_SECRET_KEY` | `POST /auth/google` |

## Graceful degradation
- GA4: no-ops when `VITE_GA4_ID` is undefined.
- Google Sign-In button: hidden (not rendered) when `VITE_GOOGLE_CLIENT_ID` is unset.
- reCAPTCHA token: null when `VITE_RECAPTCHA_SITE_KEY` unset; backend skips check when `RECAPTCHA_SECRET_KEY` unset.
- Maps embed: loads in production HTTPS; may show blank in Replit dev preview (Google blocks non-HTTPS embeds in preview).

## CSP additions required
`frame-src` must include `https://maps.google.com https://www.google.com`.
`connect-src` must include `https://accounts.google.com https://oauth2.googleapis.com`.
Both already added to `main.py` security middleware.

## GIS button pattern
Uses `google.accounts.id.renderButton()` into a div ref. Re-renders on `isSignIn` change.
Uses `roleRef` (useRef) to pass current role into the callback without adding role to the effect deps.

**Why:** Avoids stale closure for role while keeping the effect stable (only re-runs on isSignIn toggle).
**How to apply:** Any time GIS callback needs a state value that changes independently of when the button re-renders, store it in a ref and read ref.current inside the callback.
