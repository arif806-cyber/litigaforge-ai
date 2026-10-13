---
name: India Code Act downloads
description: Source-access constraints observed while trying to retrieve official Indian Act PDFs from this workspace.
---

On 2026-10-13, direct shell downloads from `indiacode.nic.in` timed out and the web-fetch service returned HTTP 500 for an official PDF, while web search still returned official URLs and short text excerpts. Those excerpts are discovery material only, not complete Acts. The Legislative Department's Constitution PDF was reachable, and the BPR&D BNS/IPC, BNSS/CrPC, and BSA/IEA correspondence PDFs were downloadable.

Crosswalk PDFs are multi-column comparison tables: preserve layout during extraction and validate parser output against known pairs (for example IPC 441 → BNS 329(1), CrPC 154 → BNSS 173, Evidence Act 65B → BSA 63). Count explicit mapping pairs, not guessed one-to-one section ranges.

**Why:** Importing incomplete excerpts as official statutory text or flattening comparison-table layout can create unreliable legal references.

**How to apply:** Verify official full-text downloads end to end. Use layout-preserving extraction for BPR&D tables and check anchor mappings before trusting row counts. Never infer a mapping when the official table has no explicit pair.
