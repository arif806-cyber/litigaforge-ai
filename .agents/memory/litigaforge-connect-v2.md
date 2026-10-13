---
name: LitigaForge Connect V2 boundary
description: Privacy and no-fee invariants for the opt-in client–advocate connection flow.
---

Connect V2 is opt-in per environment. Every Connect case and match must carry an explicit V2 marker; legacy inbox, matching, acceptance, and payment paths must exclude or reject V2 records. Client identity and contact stay hidden before acceptance, and no ranking, referral commission, or per-case fee is part of this flow.

**Why:** The feature is a separate privacy-first path, not a variation of the legacy paid matching flow.

**How to apply:** Preserve these invariants when extending either the V2 routes or legacy matching/payment endpoints; default flags off outside the intended preview environment.
