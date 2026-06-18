---
name: Forge Canvas Phase 2 — dagre, cluster, impact, hints
description: Key lessons from building Phase 2 Forge canvas features (auto-layout, clustering, impact pulse, connection hints tray).
---

# Forge Canvas Phase 2

## @dagrejs/dagre import
Use named exports — NOT default import:
```typescript
import { graphlib, layout } from "@dagrejs/dagre";
const g = new graphlib.Graph();
layout(g);
```
The package is installed in `artifacts/litigaforge-ui/node_modules` (not root), added with `pnpm --filter @workspace/litigaforge-ui add -D @dagrejs/dagre`.

**Why:** Default import (`import dagre from "..."`) has inconsistent Vite/ESM resolution; named exports from the type file (`dist/types/index.d.ts`) are the authoritative API.

## Impact pulse animation
CSS @keyframes `forge-impact-positive` / `forge-impact-negative` are injected by `injectCSS()` in `ForgeCanvas.tsx` (runs once per page). Each NodeShell reads `data.impactFlash` and applies `animation: forge-impact-${impactFlash} 1.5s ease-out forwards` on the wrapper div. The flash is cleared after 1.6s via a `setTimeout` inside `propagateImpact()`.

**Why:** Injecting keyframes globally avoids duplicate `<style>` blocks and lets all 6 node type variants share the same animation without per-component CSS.

## Cluster node lifecycle
- **Group (Ctrl+G):** filter selected non-cluster nodes → hide them (hidden:true) → create one `cluster` node at centroid → reroute external edges to proxy edges pointing at the cluster id. Store `memberIds`, `typeCounts`, `originalExternalEdges`, `proxyEdgeIds` in the cluster's `data`.
- **Ungroup (Ctrl+Shift+G or Ungroup button):** find cluster node → restore hidden members (hidden:false) → remove proxy edges → restore `originalExternalEdges`. Triggered via `CustomEvent("lf-cluster-expand")` from the ClusterNode button → `handleExpandCluster` in workspace.tsx.

**How to apply:** Any new node type added to the registry does NOT need cluster-awareness; the cluster node is a first-class `nodeTypes.cluster` entry in the registry.

## propagateImpact wiring gap
`propagateImpact(edges)` is currently called only in `onConnectTyped` (new edge drawn). It does NOT fire when a user drags the inline score scrubber on a node. Task #67 tracks wiring the score slider → propagation.

**Why:** The score scrubber update path goes through `updateNodeData` (React Flow internal), not through workspace.tsx state. Wiring it requires a custom event (`lf-score-changed`) or a node `onDataChange` callback.

## Connection hints tray
`computeConnectionHints(newNode, existing)` scores nodes by keyword overlap (stopword-filtered) + actscited array matches. Returns top-3 hints with pre-selected `relType`. Only fires for judgment nodes added from IK search (`onSearchNodesAdded`). The `ConnectionHintsTray` component is positioned `absolute bottom-0` inside the canvas container div — NOT inside `ForgeCanvas` (which would place it inside ReactFlow).
