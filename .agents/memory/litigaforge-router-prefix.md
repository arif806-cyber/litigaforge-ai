---
name: LitigaForge router double-prefix bug
description: Routers registered with prefix=BASE_PATH must not include BASE_PATH in route strings or every path doubles.
---

## The rule

When registering a FastAPI router in `main.py` like:
```python
app.include_router(my_router, prefix=BASE_PATH)  # BASE_PATH = "/litigaforge"
```

The route strings inside `my_router` must NOT include `BASE_PATH`:
```python
# WRONG — produces /litigaforge/litigaforge/court-intel/...
_BASE_PATH = os.getenv("BASE_PATH", "").rstrip("/")
@router.get(f"{_BASE_PATH}/court-intel/{case_id}/events")

# CORRECT — produces /litigaforge/court-intel/...
@router.get("/court-intel/{case_id}/events")
```

**Why:** FastAPI concatenates prefix + route string. Using `_BASE_PATH` in both places
doubles the prefix. The resulting routes appear in `/openapi.json` at the wrong path
and return 404 in production even though startup logs show no error.

**How to apply:** Any new router added to `main.py` with `prefix=BASE_PATH` must use
bare paths like `/court-intel/...`, `/my-feature/...` — never `f"{_BASE_PATH}/...`.

**How it was caught:** All new Phase 3 endpoints returned 404. The double-prefix path
(`/litigaforge/litigaforge/court-intel/...`) confirmed by returning 401 (auth hit).
Fix: `sed` replaced all `f"{_BASE_PATH}/court-intel/...` patterns with bare strings.
