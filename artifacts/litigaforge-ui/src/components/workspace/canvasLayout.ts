import { graphlib, layout } from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const NODE_W = 285;
const NODE_H = 170;

/**
 * Repositions nodes using Dagre's hierarchical layout (TB by default).
 * Hidden nodes are excluded from layout but returned unchanged.
 */
export function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): Node[] {
  const visible = nodes.filter(n => !n.hidden);
  if (visible.length < 2) return nodes;

  const g = new graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir:  direction,
    nodesep:  55,
    ranksep:  90,
    marginx:  40,
    marginy:  40,
  });

  visible.forEach(n => {
    const w = n.type === "cluster" ? 320 : NODE_W;
    const h = n.type === "cluster" ? 130 : NODE_H;
    g.setNode(n.id, { width: w, height: h });
  });

  edges.forEach(e => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  });

  layout(g);

  return nodes.map(n => {
    if (n.hidden) return n;
    const pos = g.node(n.id);
    if (!pos) return n;
    const w = n.type === "cluster" ? 320 : NODE_W;
    const h = n.type === "cluster" ? 130 : NODE_H;
    return {
      ...n,
      position: {
        x: Math.round(pos.x - w / 2),
        y: Math.round(pos.y - h / 2),
      },
    };
  });
}
