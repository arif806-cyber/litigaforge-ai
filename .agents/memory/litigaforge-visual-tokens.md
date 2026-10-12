---
name: LitigaForge visual tokens
description: Durable visual-system constraints for the LitigaForge UI and the separate Astro blog.
---

Use one shared semantic token source for the LitigaForge application UI. Gold is the primary brand color and teal is the secondary; reserve blue/violet node colors for Forge Workspace. The Astro `/blog` remains separate and unchanged until blog adoption is requested.

**Why:** the visual-system overhaul is intended to prevent cross-page color drift while keeping the workspace node categories distinct and the blog independently deployable.

**How to apply:** when styling new or existing app surfaces, use shared tokens rather than page-local colors. Do not propagate application CSS into Astro blog pages without an explicit request.
