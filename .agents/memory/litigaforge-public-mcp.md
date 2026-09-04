---
name: LitigaForge public MCP
description: Safety and cost boundaries for the public remote MCP endpoint used by clients such as Grok.
---

The public MCP endpoint must remain stateless and read-only by default. Expose
only already-public legal information, use bounded database queries, and keep
all tool output grounded in stored records or static country configuration.

**Why:** The endpoint is internet-facing and was explicitly requested without
additional ongoing billing. AI-backed tools, mutations, or account data would
introduce cost and abuse risk that the initial public transport does not need.

**How to apply:** New public tools may read bounded public data. Before adding
AI calls, user-specific data, document access, or write actions, add client
authentication, authorization scopes, stricter quotas, and an explicit cost
policy.