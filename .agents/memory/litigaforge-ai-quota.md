---
name: LitigaForge authenticated AI quota
description: Durable policy for authenticated AI usage limits across subscription plans.
---

# Flat authenticated AI quota

Every authenticated subscription plan—Free, Professional, and Advocate Pro—uses the same limit of 20 AI calls per clock hour. The bucket is per user and stored atomically in PostgreSQL.

**Why:** The user explicitly chose a flat 20/hour allowance for all plans. Proxy-IP limits are invalid for authenticated usage because Replit and Google route different users through shared, rotating addresses.

**How to apply:** Route every authenticated AI reservation through the shared hourly user bucket. Keep anonymous access on its separate abuse-prevention policy. Any quota text or usage display must say 20/hour rather than showing plan-specific daily AI limits.