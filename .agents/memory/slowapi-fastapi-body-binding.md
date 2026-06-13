---
name: slowapi + FastAPI body binding
description: Why `from __future__ import annotations` breaks FastAPI request-body binding on endpoints decorated with slowapi's @limiter.limit.
---

# slowapi `@limiter.limit` + `from __future__ import annotations` → 422 on valid bodies

**Rule:** In a FastAPI router module that puts slowapi's `@limiter.limit(...)`
on endpoints with a Pydantic request-body model, do NOT add
`from __future__ import annotations` at the top of that module.

**Why:** slowapi 0.1.9 wraps the endpoint with `functools.wraps` from inside
slowapi's own module. With PEP 563 (the future-import), the endpoint's
parameter annotations become *strings* that FastAPI resolves lazily against the
wrapper's `__globals__` — which is **slowapi's** module namespace, not your
router's. FastAPI therefore can't resolve your request model class, treats the
body parameter as an unknown/scalar, and binds it as a **query** param. Result:
a valid JSON POST returns `422 field required` as if the body fields were
expected in the query string.

**How to apply / symptom:**
- Symptom: a correct JSON body POST to a rate-limited endpoint returns 422
  ("field required") for fields that are clearly present in the body.
- Fix: remove `from __future__ import annotations` from that router module
  (leave a NOTE so nobody re-adds it). Real (non-string) annotations resolve
  in the router's own namespace and binding works again.
- A sibling router that has the same `@limiter.limit` usage but works fine is
  the tell — check whether it simply never had the future-import.
- Took >2 attempts to diagnose; the future-import looks harmless and unrelated.
