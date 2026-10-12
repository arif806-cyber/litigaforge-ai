---
name: LitigaForge demo account boundary
description: Durable safety constraints for advocate onboarding/demo fixtures and account isolation.
---

# Demo account boundary

- Demo identities must be distinct from ordinary users, clearly marked, and server-enforced. Demo workspaces/documents must contain invented facts only; never seed actual client material, legal authorities, or live search results as fixtures.
- Reset behavior must target explicitly tagged demo fixture rows owned by the demo user. It must not reset Legal Twin history or touch ordinary user records.
- A temporary demo credential must be changed before normal authenticated APIs are available. Demo billing must be disabled.

**Why:** shared or seeded demo data can otherwise be mistaken for client material or authentic legal authorities, and a frontend-only demo flag cannot protect account data.

**How to apply:** require owner-scoped backend queries, a server-side demo marker, tagged fixture rows, explicitly fictional sample documents, and a reset endpoint that rejects non-demo users before database access.
