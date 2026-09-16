---
name: LitigaForge proxy rate limits
description: Why authenticated mutations must not rely on client-IP rate-limit buckets behind the Replit deployment proxy.
---

# Authenticated mutations must not use proxy-IP buckets

**Rule:** Protect authenticated mutations with user-scoped, atomic database quotas rather than SlowAPI limits keyed by the apparent client IP.

**Why:** Production requests from one browser arrived through changing `35.191.*` Google/Replit proxy addresses, while those addresses were also shared across traffic. A low IP limit therefore returned 429 for legitimate case creation even though the signed-in user had quota remaining.

**How to apply:** Keep IP limits for anonymous abuse surfaces where no stable identity exists. For signed-in actions, use the authenticated user ID and persistent database accounting; never assume `X-Forwarded-For` identifies one LitigaForge user in production.