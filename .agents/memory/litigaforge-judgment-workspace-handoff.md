---
name: Judgment-to-workspace handoff
description: Product behavior for opening a selected judgment in the LitigaForge workspace.
---

Opening a judgment in Workspace adds it to the user's newest existing workspace while preserving all existing canvas nodes and edges. If the user has no workspace, create one for the judgment. Clear the handoff only after a successful save so reloads do not silently lose it or add duplicates.

**Why:** The request was to open the selected judgment in Workspace, without naming a destination session. Reusing the newest workspace is the least disruptive default; creating one only when none exists avoids sending the user to an empty welcome screen.

**How to apply:** Keep judgment identity in the navigation handoff through sign-in and advocate-profile completion. If a destination-workspace picker is later added, retain preservation and duplicate-safe saving.
