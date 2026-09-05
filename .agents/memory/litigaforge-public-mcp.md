---
name: LitigaForge public MCP
description: Safety and cost boundaries for the public remote MCP endpoint used by clients such as Grok.
---

The public MCP endpoint must remain stateless and read-only by default. Expose
only already-public legal information and keep all tool output grounded in
stored records, static country configuration, or the official Indian Kanoon
search API. Sparse local judgment searches may use bounded IK fallback, but a
public MCP request must never mutate the IK cache or increment cache counters.

**Why:** The endpoint is internet-facing and was explicitly requested without
additional ongoing billing. AI-backed tools, mutations, or account data would
introduce cost and abuse risk that the initial public transport does not need.

**How to apply:** New public tools may read bounded public data. Search local
judgments first; use IK only to supplement sparse results and preserve honest
source labels. Before adding AI calls, user-specific data, document access, or
write actions, add authentication, authorization scopes, stricter quotas, and
an explicit cost policy.