---
name: eCourtsIndia cause-list access
description: Verified API access boundary for DocketView cause-list fetching.
---

Keep automated cause-list retrieval fail-closed until the eCourtsIndia partner API's exact search endpoint, query parameters, response schema, and enabled account scope are confirmed. Vendor documentation advertises cause-list search and lists `GET /api/partner/causelist/available-dates` as free but Bearer-token authenticated; direct documentation access in this environment returned 403 and did not expose the search contract. The official public eCourts portal is interactive and warns that displayed lists may differ from the actual list.

**Why:** Guessing a partner route can return wrong data or incur paid API credits; scraping or bypassing the interactive portal is not an acceptable substitute for authorized API access.

**How to apply:** Ask for the provider's exact cause-list API documentation and use the existing Replit Secrets flow for the vendor-issued partner token. Do not populate DocketView with inferred or fabricated entries.
