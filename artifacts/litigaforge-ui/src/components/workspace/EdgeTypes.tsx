import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

// ─── Relationship catalogue ────────────────────────────────────────────────────

export const RELATIONSHIP_TYPES = {
  supports:      { label: "Supports",      color: "#22c55e", dash: false, icon: "↑" },
  cites:         { label: "Cites",         color: "#14b8a6", dash: false, icon: "◆" },
  distinguishes: { label: "Distinguishes", color: "#f97316", dash: true,  icon: "⊘" },
  contradicts:   { label: "Contradicts",   color: "#ef4444", dash: true,  icon: "✕" },
  procedural:    { label: "Procedural",    color: "#a855f7", dash: false, icon: "▷" },
  questions:     { label: "Questions",     color: "#eab308", dash: true,  icon: "?" },
} as const;

export type RelType = keyof typeof RELATIONSHIP_TYPES;

// ─── LabeledEdge ──────────────────────────────────────────────────────────────

export const LabeledEdge = memo((props: EdgeProps) => {
  const { id, sourceX, sourceY, targetX, targetY, data, selected, markerEnd, style } = props;

  const d    = (data ?? {}) as { relType?: string; label?: string; color?: string };
  const key  = (d.relType as RelType) || "cites";
  const rel  = RELATIONSHIP_TYPES[key] ?? RELATIONSHIP_TYPES.cites;
  const color = d.color || rel.color;

  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  function handleDblClick(e: React.MouseEvent) {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("lf-edge-retype", {
        detail: { edgeId: id, x: e.clientX, y: e.clientY },
      }),
    );
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: rel.dash ? "6 3" : undefined,
          filter: selected ? `drop-shadow(0 0 4px ${color}88)` : undefined,
          transition: "stroke-width 0.15s, filter 0.15s",
          ...style,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          onDoubleClick={handleDblClick}
          title="Double-click to change relationship type"
          style={{
            position: "absolute",
            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            display: "flex",
            alignItems: "center",
            gap: 3,
            fontSize: 8.5,
            fontWeight: 800,
            letterSpacing: "0.06em",
            padding: "2px 7px",
            borderRadius: 10,
            background: `rgba(7,13,26,0.92)`,
            border: `1px solid ${color}55`,
            color,
            cursor: "pointer",
            userSelect: "none",
            backdropFilter: "blur(6px)",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
            boxShadow: selected ? `0 0 8px ${color}44` : undefined,
            transition: "box-shadow 0.15s",
          }}
        >
          <span style={{ fontSize: 9 }}>{rel.icon}</span>
          {rel.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
LabeledEdge.displayName = "LabeledEdge";

// ─── Registry ──────────────────────────────────────────────────────────────────

export const edgeTypes = { labeled: LabeledEdge };
