---
name: LitigaForge Workspace SSE
description: First-byte and compression rules for Analyze, Simulate, and direct-agent streams.
---

Workspace SSE must emit its first frame before database, personalization, or
provider work. Every Workspace SSE path must also bypass GZip middleware.

**Why:** Yielding `start` immediately inside a generator was still insufficient:
Starlette's GZip middleware buffered the small frame, producing zero bytes for
three seconds even though the endpoint had returned HTTP 200. Moving database
work behind the first yield and bypassing GZip reduced observed first-byte time
to about 30 ms through Replit's development proxy.

**How to apply:** When adding or renaming an SSE endpoint, update the
compression-bypass matcher and add a regression test that the route selects the
raw ASGI app. Test end to end with a fresh cookie-authenticated account and
`curl -N`; an HTTP 200 in logs is not evidence that any bytes reached the client.