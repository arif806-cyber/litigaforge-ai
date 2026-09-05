# LitigaForge — make production ready

**Upload this file to the Replit project root** (`REPLIT_MAKE_PRODUCTION_READY.md`).

Then tell Replit Agent:

> Read `REPLIT_MAKE_PRODUCTION_READY.md` and implement Phase 0 then Phase 1 exactly. Do not add features. Do not invent new pages. Run the acceptance curls at the end of each phase and paste the results.

Live production host this spec was written against: `https://litigaforge.com`  
API prefix: `/litigaforge`  
Stack observed: Express static SPA (Vite/React) + FastAPI/Uvicorn.

This is an **implementation spec**, not a wishlist. If a file name below does not match the repo, search for the symbol and edit the real file.

---

## 0. How to use this in Replit

1. Drag this file into the Replit file tree (root).
2. Optional: also add `AGENTS.md` with one line: `Follow REPLIT_MAKE_PRODUCTION_READY.md in order. Stop after Phase 1 unless I say Phase 2.`
3. Work in a **staging / preview** Replit if you have one. If you only have prod, take a DB snapshot first.
4. After each phase: publish, then run the curls against the published URL.
5. Delete QA rows listed in Phase 0.

Do **not** start Phase 2 (matching polish, Workspace demo, SEO) until Phase 0 + 1 acceptance all pass.

---

## 1. Product rules (do not violate)

LitigaForge is software for **Telangana / Andhra Pradesh** advocates and litigants.

- Never say **legal advice**. Say **legal information** / **research assistance**.
- Never show **Bar Council Verified** unless a human admin set `verified=true` on a real advocate after checking bar enrolment.
- Never show a test / dummy lawyer on `/lawyers` or in match results.
- Never return `email`, `phone`, or `bar_number` on unauthenticated lawyer list/detail.
- Never claim **100+ lawyers** or **8 countries** unless the live query says so.
- Matching is a **flag**. If verified lawyers in that city + practice area = 0, return an empty state + waitlist — do not invent a 31% match.
- Payments for India = **Razorpay only**. Leave Stripe dead or delete the calls.
- Primary lawyer value: save 4–8 hours on MACT / research / drafts. Matching is secondary until supply exists.

---

## 2. Live bugs this spec fixes (already proven on prod)

| ID | Bug | Proof |
|---|---|---|
| P0-01 | Public directory is `Lawyer_test2` (0 yrs, 0 rating, `verified`) | `GET /litigaforge/lawyers` → `total: 1` |
| P0-02 | Email + phone + bar_number public with no login | Same endpoint fields |
| P0-03 | `POST /auth/register` `{role:"advocate"}` still returns `role:"client"` | User 108 |
| P0-04 | Posting a case does not match. Forced match returns test lawyer score 31, “High Court inferred”, explanation contradicts tags | Case 48 + `POST /match/find-lawyers` |
| P0-05 | Home “1 verified” vs login “100+ Lawyers” | UI copy |
| P1-01 | Q&A title “Free Legal Advice” | `/ask` |
| P1-02 | Register works with `recaptcha_token: null`, no email verify | QA accounts created this way |
| P1-03 | `/lawyers/for-lawyers` → “City Not Found”. CNR nav vs `/cnr-tracker` | SPA routes |
| P1-04 | `/subscription` and `/workspace` login-walled; `/api/stripe/*` 404 | Plans API already public-capable |
| P1-05 | After posting a case, `cases_this_month` still `0` | `GET /auth/me` after case 48 |
| P1-06 | `Access-Control-Allow-Origin: *` on Express HTML; JWT in `localStorage` | Response headers |

QA rows created during audit — **delete in Phase 0**:

- User `lf.audit.client.20260905@gmail.com` (id 107) + case requirement **48**
- User `lf.audit.adv.20260905@gmail.com` (id 108) + lawyer profile id **2** (pending)
- Public lawyer id **1** `Lawyer_test2` — unlist or mark `is_test=true` and exclude from public queries

---

## Phase 0 — stop the bleeding (do this first, same session)

### 0.1 Database

Add columns if missing (names can match existing style):

```sql
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
-- verification_status: pending | verified | rejected

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT FALSE;

-- Test / dummy rows
UPDATE lawyers
SET is_test = TRUE, verified = FALSE, verification_status = 'rejected'
WHERE name ILIKE '%test%'
   OR email ILIKE '%test%'
   OR email ILIKE '%dbtest%'
   OR name ILIKE 'Lawyer_test%';

DELETE FROM users
WHERE email IN (
  'lf.audit.client.20260905@gmail.com',
  'lf.audit.adv.20260905@gmail.com'
);
-- cascade case 48 / lawyer 2 if FKs require it
```

Public list query **must** be:

```sql
SELECT ... FROM lawyers
WHERE verified = TRUE
  AND COALESCE(is_test, FALSE) = FALSE
  AND verification_status = 'verified';
```

### 0.2 Public serializer (P0-02)

Find the handler for `GET /litigaforge/lawyers` and `GET /litigaforge/lawyers/{id}`.

**Public JSON (no auth) may include only:**

`id, name, district, city, practice_areas, languages, experience_years, rating, verification_status, verified, bio, availability, hourly_rate` (hourly_rate optional)

**Must omit:** `email, phone, bar_number, subscription_tier, user_id`

After an **accepted** match, the match payload may include contact fields for that one lawyer.

Add a unit/API test: anonymous `GET /lawyers` body must not contain the keys `email`, `phone`, `bar_number`.

### 0.3 Honest counters (P0-05)

Create one function `get_public_stats()`:

```python
verified_advocates = count(lawyers where verified and not is_test)
ai_answers = count(qna or ask rows)
ready_documents = count(published templates)  # never blank
```

Use it on:

- homepage counters
- login left rail (`100+ Lawyers` → the real number)
- any OG / marketing fragment that hardcodes counts

If `verified_advocates < 20`, login copy is:

> Early access · Hyderabad & Telangana advocates onboarding

Not “100+ Lawyers”. Remove “Available in 8 countries” from the India homepage hero.

### 0.4 Phase 0 acceptance

```bash
BASE=https://YOUR-REPLIT-URL
curl -s "$BASE/litigaforge/lawyers" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert 'email' not in str(d.get('lawyers',[{}])[0] if d.get('lawyers') else {})
print('lawyers total', d.get('total'))
print('names', [x.get('name') for x in d.get('lawyers',[])])
assert all('test' not in (x.get('name') or '').lower() for x in d.get('lawyers',[]))
print('P0 lawyers OK')
"
```

Homepage and `/login` must show the **same** advocate count as `total` above.

---

## Phase 1 — auth, roles, routes, copy, quotas

### 1.1 Register must honour role (P0-03)

`POST /litigaforge/auth/register` body already is:

```json
{ "name": "", "email": "", "password": "", "role": "client|advocate", "recaptcha_token": null }
```

**Required behaviour:**

- Persist `users.role = role` exactly (`client` or `advocate`).
- Default `email_verified = false`, `is_profile_public = false`.
- If `role=advocate`, response still includes token, but frontend routes to `/lawyers/register` (bar number, phone, district, practice_areas).
- Completing `POST /litigaforge/lawyers/register` sets `lawyer_status=pending`, `verified=false`. It does **not** flip `verified`.
- `GET /auth/me` for that user: `role=advocate`, `lawyer_status=pending`, `is_verified=false`.
- `/lawyer-dashboard` for pending advocates: a single “Under review” panel. Do not dump them into the client dashboard.
- Only an admin endpoint may set `verified=true`.

### 1.2 Email verify + captcha + rate limit (P1-02)

- Reject register if `recaptcha_token` is missing when `RECAPTCHA_SECRET` is set. If secret is unset in Replit secrets, log a loud warning and still rate-limit.
- Rate-limit `/auth/register` and `/cases/requirements`: 5 / hour / IP.
- Block `POST /cases/requirements` and `POST /lawyers/register` unless `email_verified=true` **or** (temporary) a Replit secret `ALLOW_UNVERIFIED=1` for local preview only. Prod: secret off.
- Send a verify link. `/auth/verify?token=` sets `email_verified=true`.

Minimum if you cannot send email today: require a 6-digit OTP stored hashed, even if you log the OTP in Replit logs for staging. Do not ship prod with `ALLOW_UNVERIFIED=1`.

### 1.3 Quota (P1-05)

On successful insert of a case requirement:

```sql
UPDATE users
SET cases_this_month = cases_this_month + 1
WHERE id = :user_id;
```

Same transaction. Free tier: 5 / month. 6th request → HTTP 402 with `{ "detail": "Free plan limit reached", "upgrade": "/subscription" }`.

`GET /auth/me` must reflect the new count immediately.

### 1.4 Matching on create (P0-04) — safe mode

Inside `POST /cases/requirements`, after insert:

1. Call the existing match job with `case_requirement_id`.
2. Eligible lawyers: `verified AND NOT is_test` AND (district/city overlap OR statewide) AND practice area overlap with `case_type`.
3. If eligible set is empty → `matches: []`. Store nothing fake.
4. If eligible set nonempty → score from **tags first** (area + city). Do not invent “Admitted to Telangana High Court (inferred)” unless you have a real enrolment/court field.
5. If AI explanation disagrees with tags, **tags win**. Prompt the model: “This lawyer’s practice_areas include X. Do not say they lack X.”
6. Do **not** set `payment_status=pending_payment` on a free introduction. Use `none` or `not_required` until a paid intro product exists.
7. Feature flag `MATCHING_ENABLED=false` (Replit secret) short-circuits to empty matches. Keep it **false** until ≥ 5 verified lawyers in Hyderabad.

### 1.5 Routes (P1-03)

| Broken | Fix |
|---|---|
| `/lawyers/for-lawyers` parsed as city `for-lawyers` | Lawyer marketing page lives at **`/for-lawyers`**. Nav “For Lawyers” points there. City route is only `/lawyers/:city` where city is a known district list. Unknown slug → “No advocates in this city yet”, not “City Not Found”. |
| `/cnr` empty | All nav links use `/cnr-tracker`. `/cnr` redirects to `/cnr-tracker`. |
| Logged-out sidebar shows Dashboard / Messages / Matches | Logged-out IA = public tools only (Ask, Documents, Analyzer, Judgments, Legal Aid, Find a Lawyer, For Lawyers, Login). |

### 1.6 Copy (P1-01)

Search the frontend for `advice` / `Advice` / `Free Legal Advice`.

Replace product strings:

- “Free Legal Advice” → “Free legal information”
- “Ask a Legal Question” can stay
- Persistent disclaimer component on `/ask`, `/review`, `/legal-chat`, `/free-documents`:

> This is not legal advice and not a substitute for an advocate. AI can be wrong. For representation, consult a qualified advocate.

PWA `manifest.webmanifest` shortcut description: drop “legal questions” if it implies advice; use “legal information”.

About page: change “Legal advice should not be a privilege.” → “Clear legal information should not be a privilege.”

### 1.7 Pricing page public (P1-04)

- `/subscription` (or new `/pricing`) is **readable logged-out**.
- Data source: existing `GET /litigaforge/subscription/plans`.
- Show Free / Professional ₹999 / Advocate Pro ₹2499.
- CTA “Start free” → register. CTA “Upgrade” → login then Razorpay `POST /litigaforge/subscription/create-order` with body `{ "tier": "professional" }` (this is the live field name).
- Remove or feature-flag frontend `fetch('/api/stripe/checkout')` — those routes 404 on Express.
- Workspace: logged-out page may show a static explainer + “Sign in to open Workspace”. Do not hard-redirect the whole URL before paint if you can avoid it.

### 1.8 Headers (P1-06)

Express:

- `app.disable('x-powered-by')`
- Do **not** set `Access-Control-Allow-Origin: *` on HTML.
- API CORS: allow only `https://litigaforge.com` and the Replit preview origin.

### 1.9 Phase 1 acceptance

```bash
BASE=https://YOUR-REPLIT-URL

# advocate role sticks
curl -s -X POST "$BASE/litigaforge/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Phase1 Adv","email":"phase1.adv@example.com","password":"Phase1Test!26","role":"advocate","recaptcha_token":"test"}'
# expect user.role == advocate

# public lawyers have no PII
curl -s "$BASE/litigaforge/lawyers" | grep -Ei 'email|phone|bar_number' && echo FAIL || echo PII_ABSENT_OK

# for-lawyers is not a city 404
curl -sL "$BASE/for-lawyers" | grep -i 'City Not Found' && echo FAIL || echo FOR_LAWYERS_OK
```

Manual: `/ask` heading must not contain the word Advice. `/subscription` readable while logged out.

---

## Phase 2 — only after Phase 1 is green

Do these as a second Replit Agent session.

### 2.1 Homepage for the real wedge

Two CTAs above the fold:

1. Litigant: Ask a question / Get a document pack  
2. Advocate: Join as advocate — “Save 4–8 hours on MACT and research”

Put a **MACT / hit-and-run document pack** card on home (Form I, claim petition, medical index). Fill the blank “Ready-to-file documents” number from the template count.

Hero sample case: label **DEMO**, never LIVE + BAR-VERIFIED on fiction.

### 2.2 Analyzer prompt guard

System prompt addition:

> Do not ask the user to upload Aadhaar, PAN, or biometrics to this website. If a contract should contain identity details, say they belong in the registered deed, not in our upload.

Keep the TPA / Registration Act quality — that part is good.

### 2.3 Judgments

Dedupe by CNR / case title + court. Hide or badge “docket only” when there is no operative order. Default India sort: Telangana HC, TS district courts, AP HC Amaravati, then SCI.

### 2.4 Workspace empty state

If `GET /workspace/sessions` is `[]`, show a seeded **sample MACT canvas** (read-only) instead of a blank twin_score=0 dashboard. Remove “NEW” from nav if the user cannot enter.

### 2.5 SEO

`noindex` blog posts whose path is Germany / UAE / Singapore / UK / US until you actually serve those countries. Bump sitemap `lastmod`. Keep robots.txt private-path disallows (already good).

### 2.6 Dead nav

Hide Messages until a match is accepted. Hide CNR tracker until the user links a CNR. `/chat/messages` GET 405 is not a product.

---

## Phase 3 — human work Replit cannot do

Agent cannot recruit lawyers. You must:

1. Verify real Hyderabad / Secunderabad / Warangal / Vijayawada advocates by hand (bar enrolment).
2. Target **20 verified** before turning `MATCHING_ENABLED=true`.
3. Put GSTIN, legal entity name, Hyderabad address, governing law on `/terms` as real HTML (not only SPA chrome).
4. Confirm Razorpay live keys in Replit Secrets (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) and a test ₹1 payment.
5. Turn off `ALLOW_UNVERIFIED`.

---

## File hunt map (search these symbols)

The GitHub mirror is nearly empty; search the Replit tree:

| Symbol / path | Change |
|---|---|
| `POST` `/auth/register` | Persist `role` |
| `Hi("/auth/register"` or auth context | Same |
| `GET` `/lawyers` response model | Public serializer |
| `Lawyer_test2` / seed scripts | Stop seeding to prod |
| `"100+"` / `100+ Lawyers` | Dynamic count |
| `Free Legal Advice` | Copy |
| `/lawyers/for-lawyers` nav href | `/for-lawyers` |
| `/cnr` links | `/cnr-tracker` |
| `cases_this_month` | Increment on insert |
| `/match/find-lawyers` | Call from case create; tag-first score |
| `/api/stripe/` | Delete or flag off |
| `create-order` + `tier` | Keep Razorpay |
| `x-powered-by` / CORS | Express |
| `manifest.webmanifest` | Shortcut copy + icons |

---

## Definition of production-ready (toolkit SKU)

You may call the **AI toolkit** production-ready when:

- [ ] Public `/lawyers` has zero test names and zero email/phone/bar_number
- [ ] Homepage count == login count == API `total`
- [ ] Advocate register → `role=advocate` → pending dashboard
- [ ] No UI string “legal advice”
- [ ] `/for-lawyers` works; `/cnr` redirects
- [ ] `/subscription` visible logged-out
- [ ] Case post increments quota
- [ ] `MATCHING_ENABLED=false` **or** matches only verified non-test lawyers
- [ ] Razorpay test payment works; Stripe calls gone
- [ ] QA audit users deleted

You may call the **marketplace** production-ready only when the above is true **and** ≥ 20 verified TS/AP advocates exist.

Until then: ship toolkit + For Lawyers waitlist. Do not run ads that promise matching.

---

## Replit Agent prompt (paste)

```
Read REPLIT_MAKE_PRODUCTION_READY.md.

Implement Phase 0 completely, then Phase 1 completely.

Do not implement Phase 2 or 3 unless I say so.
Do not add new product features.
Do not change the visual design system except copy and nav targets.
Search the repo for the symbols in the file-hunt map.
After Phase 0 and Phase 1, print the files you changed and the acceptance curl results.
If a secret is missing, list it under "SECRETS NEEDED" and continue with a safe default that fails closed.
```
