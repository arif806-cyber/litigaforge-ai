---
name: LitigaForge lifespan conn scope
description: Where to place new table-init blocks in main.py lifespan, and the users.id type (INTEGER, not UUID).
---

## Rule
Any new `CREATE TABLE` / migration block in `main.py`'s `lifespan()` function **must** live inside the outer `try:` block, before the `except Exception as e:` + `finally: await pool.release(conn)` lines.

Placing it after the `finally` block means `conn` has already been returned to the pool → silent `cannot call Connection.execute(): connection has been released` error; tables silently never get created.

## users.id type
`users.id` is `SERIAL PRIMARY KEY` → **INTEGER**, not UUID.  
Any FK column referencing `users(id)` (e.g. `user_id`) must be declared `INTEGER NOT NULL`, not `UUID`.  
The court intelligence tables (`tracked_cases`, `case_notifications`) hit this — fixed 2026-07-01.

**Why:** The project predates the UUID-PK convention; changing `users.id` would require a full schema migration.

**How to apply:** When adding a new table that references `users(id)`, always declare `user_id INTEGER NOT NULL REFERENCES users(id)`. Use UUID PKs only for the new table's own `id` column (safe with `gen_random_uuid()`).
