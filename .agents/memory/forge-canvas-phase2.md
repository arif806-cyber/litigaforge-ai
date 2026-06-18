---
name: Forge Canvas Phase 2 — dagre, cluster, impact, hints
description: Non-obvious decisions from building Phase 2 Forge canvas features (auto-layout, clustering, impact pulse, connection hints tray).
---

# Forge Canvas Phase 2

## @dagrejs/dagre import
Use named exports — NOT default import:
```typescript
import { graphlib, layout } from "@dagrejs/dagre";
const g = new graphlib.Graph();
layout(g);
```
**Why:** `import dagre from "..."` has inconsistent ESM/CJS resolution in Vite; the named exports in `dist/types/index.d.ts` are the authoritative API.

## Two separate impact flash paths
- **Edge-connect path** (`propagateImpact` in `onConnectTyped`): mutates neighbor `impact_score` AND sets `impactFlash` on them. Score change is intentional (the pre-existing behavior). Flash is the Phase 2 addition.
- **Score-change watcher** (`useEffect([nodes])`): compares `prevNodeScoresRef` vs current scores, flashes first-degree neighbors VISUALLY ONLY — no score mutation. Uses `flashTimersRef` to cancel duplicate timers on rapid edits.

**Why separate:** The watcher must NOT mutate scores (infinite loop risk) — only the connect path mutates. The watcher deps array is `[nodes]` (not `[nodes, edges]`) to avoid double-firing; `edges` is read via closure.

## Score-change watcher loop-safety
The watcher sets `impactFlash` on neighbor nodes → nodes array changes → watcher fires again. Loop is safe because the second run checks score changes (not impactFlash changes) — scores didn't change, so `changedNodeIds` is empty → early return.

## Cluster node lifecycle
Group: hide members (hidden:true) + create cluster node at centroid + replace external edges with proxy edges storing `originalExternalEdges` + `proxyEdgeIds`. Ungroup: restore members (hidden:false) + remove proxy edges + restore originalExternalEdges. Triggered via `CustomEvent("lf-cluster-expand")` from ClusterNode → `handleExpandCluster`.

## CSS @keyframes injection
Impact flash @keyframes live in `injectCSS()` in ForgeCanvas.tsx (injected once per page load). All 6 node types share them via the `animation: forge-impact-${flash} 1.5s ease-out forwards` property on their NodeShell wrapper div. When no flash, `animation` is `undefined` (browser ignores undefined style values).
