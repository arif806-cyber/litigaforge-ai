---
name: Advocate restore behavior
description: Keep profile visibility and verification as separate admin decisions.
---

Restoring a hidden advocate clears the admin-hidden flag only. It must not restore verification automatically; the admin must make a separate verification decision.

**Why:** Visibility restoration is not evidence that bar credentials or profile information were verified.

**How to apply:** Admin actions that restore a hidden advocate should preserve the current verification status and rejection reason, and must not alter test-fixture classification.
