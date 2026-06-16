---
name: LitigaForge daily judgment digest
description: The daily Top-5 judgment email digest subsystem — what exists, the hybrid opt-in design (single while SMTP incomplete, double once configured), the country field, and SMTP/scheduler constraints. Read before building anything "digest".
---

# Daily judgment digest

A complete, deliberate subsystem — **do NOT rebuild it**. A detailed "build the
digest" spec has been re-sent more than once; verify against this and fill only
genuine gaps.

Parts:
- **Service + scheduler** — `digest.py`: `send_daily_digest()` selects the top-5
  published judgments ingested in the last ~26h (Supreme Court > High Court >
  other, then recency) and emails each active subscriber. The daily scheduler is
  **PROD-ONLY** at 07:00 IST (01:30 UTC), started/cancelled in `main.py` lifespan.
- **HTTP** — `/digest/subscribe` + `/digest/unsubscribe` (tokenized, styled page) +
  `/digest/confirm/{token}` (double opt-in confirm, reuses the unsub styled-page
  renderer) in `routers/community.py`; `/admin/digest/send` (superuser-gated manual
  trigger) in `routers/admin.py`.
- **Email render** — `alerts/email.py`: `send_digest_email` (the digest) +
  `send_confirmation_email` (the double opt-in link email); both XSS-escape untrusted
  fields and scheme-validate URLs.
- **Frontend** — `/digest` signup page (`pages/digest.tsx`, routed in `App.tsx`):
  name + email + **country dropdown** (`select-country`). Success UI is
  response-driven: shows "check your email" when the API returns `confirmed:false`,
  else "you're subscribed".
- **Table** `digest_subscribers` created in the `main.py` lifespan, with a `country`
  column added via post-creation `ALTER TABLE`.

## Design decisions / constraints (the non-obvious part)
- **Hybrid opt-in (as of 2026-06-16)**: subscribe branches on `smtp_configured()`.
  - SMTP incomplete → **single opt-in**: row written `confirmed=TRUE`, no email, API
    returns `confirmed:true`. (This is the current live behaviour — see SMTP below.)
  - SMTP fully configured → **double opt-in**: row written `confirmed=FALSE` with a
    `confirm_token`, a confirmation email is sent, API returns `confirmed:false`;
    only `/digest/confirm/{token}` flips `confirmed=TRUE` and clears the token.
  - **Why hybrid, not pure double opt-in**: with no SMTP, a confirmation email can't
    be delivered, so forcing double opt-in would silently break every signup.
  - `send_daily_digest()` + active-count queries filter `is_active = TRUE AND
    confirmed = TRUE`. Pre-existing prod rows are already `confirmed=TRUE`, so this
    filter is a no-op for them (no regression).
  - Caveat: when SMTP is configured but the live send fails/times out, subscribe
    still returns `confirmed:false`; the user may need to resubmit once SMTP is fixed.
- **Fail-closed SMTP**: `smtp_configured()` requires `SMTP_HOST`+`SMTP_USER`+`SMTP_PASSWORD`.
  When unset, `send_daily_digest()` logs LOUD and sends nothing (`reason="smtp_unconfigured"`)
  — it never mock-delivers to real subscribers. **As of 2026-06-16 SMTP is fully configured
  and live**: Gmail `smtp.gmail.com:587` STARTTLS, `SMTP_USER=arif.806@gmail.com`,
  `SMTP_PASSWORD` set as a global secret (Gmail **App Password**, ~19 chars incl. spaces —
  spaces are fine; the normal account password is rejected by Gmail). `SMTP_FROM` unset →
  falls back to `SMTP_USER`. So **double opt-in is now the live path** (subscribe →
  confirmation email → confirmed:false). SMTP env reads happen at module import in
  `alerts/email.py`, so changing any `SMTP_*` value requires a **backend restart**. Secrets
  are global (dev+prod); the daily-send scheduler is still PROD-ONLY, and prod only gets
  this behaviour **after a republish**.
- **`country` column** (`TEXT DEFAULT 'in'`): subscribe validates against
  `{in,us,uk,ae,de,au,ca,sg}` and falls back to `'in'` for unknown values. Collected
  for future per-country segmentation; digest selection is still India-only today.

## Gotcha
`CREATE TABLE IF NOT EXISTS` does **not** add later-added columns to an
already-existing table. Adding a column to `main.py`'s CREATE block will NOT reach
existing dev/prod tables — use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for
post-creation columns.
