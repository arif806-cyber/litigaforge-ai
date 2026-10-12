---
name: eCourtsIndia cause-list access
description: Verified API access boundary for DocketView cause-list fetching.
---

Use only the eCourtsIndia Partner API for automated cause lists; never scrape the official portal. `GET /api/partner/causelist/court-structure/...` and `POST /api/partner/case/bulk-refresh-status` are free, but the verified court-structure calls still require the configured Bearer token. Court hierarchy responses may be top-level arrays. Cause-list search is metered: production prefetch is scheduled at 06:00 and 12:00 IST, and DocketView page requests must remain cache-only. Current caches and usage estimates are process-local and reset on restart.

**Why:** Cause-list traffic is metered, and a failed/guessed route can spend credits or show unreliable listings; only authorized API data is acceptable.

**How to apply:** Use the shared server-side client and secret flow. Keep vendor calls out of page-load paths, poll free refresh status before any repeat refresh, and describe process-local caching/usage honestly until durable storage is added.
