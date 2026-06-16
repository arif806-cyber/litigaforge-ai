---
name: LitigaForge daily judgment digest
description: The daily Top-5 judgment email digest subsystem — what exists, the single opt-in design, and SMTP/scheduler constraints. Read before building anything "digest".
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
- **Email render** — `alerts/email.py::send_digest_email` (inline HTML; XSS-escapes
  every untrusted judgment/subscriber field and scheme-validates URLs). stdlib smtplib.
- **HTTP** — `/digest/subscribe` + `/digest/unsubscribe` (tokenized, styled page) in
  `routers/community.py`; `/admin/digest/send` (superuser-gated manual trigger) in
  `routers/admin.py`.
- **Frontend** — `/digest` signup page (`pages/digest.tsx`, routed in `App.tsx`):
  name + email only.
- **Table** `digest_subscribers` created in the `main.py` lifespan.

## Design decisions / constraints (the non-obvious part)
- **Single opt-in by design**: subscribe sets `confirmed=TRUE` immediately. The
  `confirm_token`/`confirmed` columns exist but there is **no** `/digest/confirm/{token}`
  flow. **Switching to double opt-in is UNSAFE while SMTP is unconfigured** — no
  confirmation email could be delivered, so every signup would silently break.
- **Fail-closed SMTP**: `smtp_configured()` requires `SMTP_HOST`+`SMTP_USER`+`SMTP_PASSWORD`.
  When unset, `send_daily_digest()` logs LOUD and sends nothing (`reason="smtp_unconfigured"`)
  — it never mock-delivers to real subscribers. As of 2026-06-16 **no `SMTP_*` secret is
  set**, so the digest captures subscribers but cannot deliver until SMTP is configured.
- **No `country` column** in the live table (a re-sent spec asked for one); digest
  selection is India-only, so a country field would be collected-but-unused today.

## Gotcha
`CREATE TABLE IF NOT EXISTS` does **not** add later-added columns to an
already-existing table. Adding a column to `main.py`'s CREATE block will NOT reach
existing dev/prod tables — use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for
post-creation columns.
