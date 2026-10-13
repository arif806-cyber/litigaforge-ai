---
name: India Code Act downloads
description: Source-access constraints observed while trying to retrieve official Indian Act PDFs from this workspace.
---

On 2026-10-13, direct shell downloads from `indiacode.nic.in` timed out and the web-fetch service returned HTTP 500 for an official PDF, while web search still returned official URLs and short text excerpts. Those excerpts are discovery material only, not complete Acts.

**Why:** Importing incomplete excerpts as official statutory text or using them to assert section mappings would create unreliable legal references.

**How to apply:** Before loading Acts or completing a statutory crosswalk, verify that an official full-text source can be downloaded and parsed end to end. If it cannot, report the limitation instead of seeding guessed or partial sections as complete.
