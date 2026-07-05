---
name: ForgeOS Growth & Competitive Intelligence Program
description: Recurring (not one-off) ForgeOS mission schedules layered on Business Pulse for SEO/onboarding/competitor tracking; reuses existing tables, no new schema.
---

Recurring ForgeOS schedules are implemented as builder functions in a dict (`BUILDERS`), dispatched by a generic registry in the scheduler rather than a single hardcoded `if builder_name == "business_pulse"` branch. Adding a new recurring mission type means: write a builder that returns `(title, description) | None`, register it in the module's `BUILDERS` dict, add a row to `INITIAL_SCHEDULES` with a staggered `next_run_at` offset, done — no scheduler.py changes needed per-mission.

**Why:** the original scheduler only knew about one recurring job (Business Pulse). Hardcoding a second `if` branch per new job type doesn't scale and risks the schedules all firing in the same poll tick if `next_run_at` isn't staggered.

**How to apply:** any future "keep checking X periodically" ForgeOS request should reuse this registry pattern and the same cost-cap gate (`_daily_cost_cap_exceeded()` — every builder must check it and return `None`, not raise, when the daily AI budget is spent) rather than inventing a new dispatch mechanism.

Key sub-decisions worth preserving:
- **Snapshot cadence != mission cadence.** External scraping (e.g. competitor sites) is cached with its own TTL (~20h) in `forgeos_memory`, independent of how often the mission that reads it fires (weekly). Readers get a lazily-refreshed cache, not a fresh scrape per mission run.
- **Outbound scraping must be defensive by default**: per-request timeout, an overall time budget across all targets, a response-size cap, and a real User-Agent — and it must never raise out of a builder; a failed target degrades to "unavailable this run" in the diff output.
- **Rotation state (e.g. "which blog topic is next") belongs in a `forgeos_memory` cursor**, not derived by scanning past mission titles — title-scanning breaks silently if titles change wording.
- **Honesty boundary is load-bearing, not cosmetic**: ForgeOS agents are LLM-text generators only (draft briefs/specs for human review). Any mission whose real-world equivalent doesn't exist (e.g. no public Bar Council verification API) must produce a design-doc-only output and say so explicitly in the mission body — never imply an action was actually taken.
