---
name: LitigaForge Q&A privacy
description: Privacy and publication invariants for user-submitted legal questions.
---

User legal questions and AI answers are private records by default. A Community Q&A item may become public only when the user explicitly opts in at ask time, the app creates separate redacted public copies, and a superuser approves the pending item.

**Why:** Legal questions routinely contain identifying and financial details. Reusing the owner's original text or publishing automatically creates an unacceptable privacy risk; AI answers can also repeat identifiers from the question.

**How to apply:** Keep private originals owner-scoped. Public reads must require opt-in plus approved moderation status and return only redacted question/answer fields. Deduplicate only public candidates so private owner records are never discarded.