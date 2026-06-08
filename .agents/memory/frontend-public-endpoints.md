---
name: Frontend public API endpoints allowlist
description: Any backend endpoint called from a public (no-login) page must be added to PUBLIC_PATH in api.ts
---

# PUBLIC_PATH allowlist (litigaforge-ui)

`src/lib/api.ts` has a `PUBLIC_PATH` regex. On a 401, `apiFetch` attempts a silent
token refresh and, if that fails, redirects to `/login` — UNLESS the path matches
`PUBLIC_PATH`, in which case the 401 falls through to normal error handling.

**Rule:** when you add a backend endpoint that is called from a page reachable
without login (Legal Q&A, Document Analyzer, Judgment Finder, etc.), add its path
to the `PUBLIC_PATH` regex. Otherwise a stale/invalid auth cookie causes a 401 that
bounces public-page users to the login screen.

**Why:** the `/clarify` endpoint (used by ask/judgments/review, all public) was
initially missing from the allowlist and would have triggered unwanted login
redirects on auth-cookie 401s.
