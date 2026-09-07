---
name: LitigaForge async AI jobs
description: Durable rules for long-running browser AI operations and bounded structured model output.
---

Long browser-facing AI operations must return an accepted job immediately and complete through PostgreSQL-backed status polling. Reserve authentication and daily usage at enqueue time, and move synchronous provider/OCR work off the FastAPI event loop.

**Why:** Long provider calls complete successfully behind the server but exceed browser/proxy request windows. A real document-analysis browser run took about 49 seconds and succeeded through polling without losing the submitted input.

**How to apply:** Keep short clarification calls synchronous. For long operations, return an unguessable job ID, enforce owner access for authenticated jobs, and persist the active job ID plus submitted input in browser storage so a route remount, reload, or worker activation resumes the same job instead of silently resetting or charging twice. Poll errors, failed status, malformed completion, and timeout must all end in the same visible retry state; log one metadata-only completion event.

Any model response that must parse as JSON needs an explicit total-word budget, item-count limits, and field-length limits. Decode the first complete object rather than greedily matching from the first opening brace to the last closing brace.

**Why:** The analyzer once returned 11,347 characters at a 2,500-token output cap and was truncated before its closing brace. A more permissive parser could not repair an incomplete object; bounding the model output produced a substantive completed result.

**How to apply:** Bound arrays and prose fields in the prompt, require the model to close JSON before the output limit, tolerate Markdown/trailing disclaimers when decoding, and fail the job rather than displaying a fabricated “50/100” fallback when parsing truly fails.