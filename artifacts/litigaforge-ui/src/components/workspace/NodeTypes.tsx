import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function scoreGlow(score: number, color: string): string {
  if (score >= 90) return `0 0 0 1.5px ${color}99, 0 0 20px ${color}55, 0 0 40px ${color}22`;
  if (score >= 75) return `0 0 0 1px ${color}66, 0 0 12px ${color}33`;
  if (score >= 60) return `0 0 8px ${color}22`;
  return "";
}

function selectedGlow(color: string): string {
  return `0 0 0 2px ${color}cc, 0 0 28px ${color}66, 0 0 56px ${color}22`;
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const pct = Math.min(100, Math.max(0, score));
  const barColor =
    pct >= 80 ? color :
    pct >= 60 ? "#f59e0b" :
    "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        flex: 1, height: 3, borderRadius: 3,
        background: "rgba(255,255,255,0.07)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
          borderRadius: 3,
          transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
          boxShadow: `0 0 6px ${barColor}66`,
        }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color: barColor, minWidth: 20, textAlign: "right" }}>
        {pct}
      </span>
    </div>
  );
}

function GradientHeader({ color, label }: { color: string; label: string }) {
  return (
    <div style={{
      height: 2,
      borderRadius: "10px 10px 0 0",
      background: `linear-gradient(90deg, ${color}00, ${color}cc, ${color}00)`,
      margin: "-10px -12px 8px",
    }} />
  );
}

interface NodeShellProps {
  children: React.ReactNode;
  borderColor: string;
  bgColor: string;
  accentColor: string;
  selected?: boolean;
  isConnectable?: boolean;
  score?: number;
  collapsed?: boolean;
  onToggleCollapse?: (e: React.MouseEvent) => void;
}

function NodeShell({
  children,
  borderColor,
  bgColor,
  accentColor,
  selected,
  isConnectable,
  score = 70,
  collapsed,
  onToggleCollapse,
}: NodeShellProps) {
  const glow    = selected ? selectedGlow(accentColor) : scoreGlow(score, accentColor);
  const hStyle  = (pos: "top" | "right" | "bottom" | "left"): React.CSSProperties => ({
    background: accentColor,
    border: `1.5px solid rgba(7,13,26,0.8)`,
    width: 9,
    height: 9,
    borderRadius: "50%",
    transition: "opacity 0.15s, transform 0.15s, box-shadow 0.15s",
    boxShadow: `0 0 6px ${accentColor}88`,
  });

  return (
    <>
      {/* 4 handles — all bidirectional */}
      <Handle type="target"  position={Position.Top}    id="top"    isConnectable={isConnectable} style={hStyle("top")} />
      <Handle type="source"  position={Position.Right}  id="right"  isConnectable={isConnectable} style={hStyle("right")} />
      <Handle type="source"  position={Position.Bottom} id="bottom" isConnectable={isConnectable} style={hStyle("bottom")} />
      <Handle type="target"  position={Position.Left}   id="left"   isConnectable={isConnectable} style={hStyle("left")} />

      <div style={{
        background: bgColor,
        border: `1.5px solid ${selected ? accentColor : borderColor}`,
        borderRadius: 12,
        minWidth: 220,
        maxWidth: 280,
        padding: "10px 12px",
        boxShadow: glow
          ? `${glow}, 0 8px 32px rgba(0,0,0,0.6)`
          : "0 4px 20px rgba(0,0,0,0.5)",
        transition: "box-shadow 0.25s, border-color 0.2s",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Top gradient bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${accentColor}cc, transparent)`,
          borderRadius: "12px 12px 0 0",
        }} />

        {/* Collapse toggle */}
        {onToggleCollapse && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={onToggleCollapse}
            style={{
              position: "absolute", top: 8, right: 8,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: 5,
              color: "#64748b",
              fontSize: 10,
              width: 18, height: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              transition: "all 0.15s",
            }}
            title={collapsed ? "Expand node" : "Collapse node"}
          >
            {collapsed ? "⊞" : "⊟"}
          </button>
        )}

        {children}
      </div>
    </>
  );
}

function NodeHeader({
  icon, label, typeLabel, color, badge,
}: {
  icon: string; label: string; typeLabel: string; color: string; badge?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 6, paddingRight: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{
          fontSize: 8.5, fontWeight: 800, textTransform: "uppercase",
          letterSpacing: "0.1em", color, opacity: 0.85,
        }}>{typeLabel}</span>
        {badge && <span style={{ marginLeft: "auto" }}>{badge}</span>}
      </div>
      <div style={{
        fontWeight: 700, fontSize: 12, color: "#e2e8f0", lineHeight: 1.35,
        wordBreak: "break-word",
      }}>
        {label}
      </div>
    </div>
  );
}

function NodeBody({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p style={{
      fontSize: 10, color: "#94a3b8", lineHeight: 1.55, margin: "4px 0 0",
      overflow: "hidden", display: "-webkit-box",
      WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
    }}>{text}</p>
  );
}

function NodeFooter({ score, extra, color }: { score?: number; extra?: React.ReactNode; color: string }) {
  return (
    <div style={{
      marginTop: 8, paddingTop: 6,
      borderTop: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      {extra && <div>{extra}</div>}
      {score !== undefined && <ScoreBar score={score} color={color} />}
    </div>
  );
}

// ─── Judgment Node ─────────────────────────────────────────────────────────────

export const JudgmentNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const { updateNodeData } = useReactFlow();
  const d         = data as Record<string, unknown>;
  const collapsed = Boolean(d.collapsed);
  const score     = Number(d.impact_score ?? 75);

  return (
    <NodeShell bgColor="#081c38" borderColor="#0d9488" accentColor="#14b8a6"
      selected={selected} isConnectable={isConnectable} score={score}
      collapsed={collapsed} onToggleCollapse={e => { e.stopPropagation(); updateNodeData(id, { collapsed: !collapsed }); }}>
      <NodeHeader icon="⚖️" label={String(d.label || "Judgment")} typeLabel="Precedent" color="#14b8a6"
        badge={d.url ? (
          <a href={String(d.url)} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 8.5, color: "#0d9488", textDecoration: "none", fontWeight: 700 }}>
            View →
          </a>
        ) : undefined}
      />
      {!collapsed && (
        <>
          {(d.court || d.year) && (
            <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              {String(d.court || "")} {d.year ? `· ${d.year}` : ""}
            </div>
          )}
          {d.citation && (
            <div style={{ fontSize: 9, color: "#0d9488", fontWeight: 700, marginBottom: 4 }}>
              {String(d.citation)}
            </div>
          )}
          <NodeBody text={String(d.summary || d.description || "")} />
          <NodeFooter score={score} color="#14b8a6" />
        </>
      )}
    </NodeShell>
  );
});
JudgmentNode.displayName = "JudgmentNode";

// ─── Fact Node ────────────────────────────────────────────────────────────────

export const FactNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const { updateNodeData } = useReactFlow();
  const d         = data as Record<string, unknown>;
  const collapsed = Boolean(d.collapsed);
  const score     = Number(d.impact_score ?? 70);

  return (
    <NodeShell bgColor="#050e22" borderColor="#2563eb" accentColor="#60a5fa"
      selected={selected} isConnectable={isConnectable} score={score}
      collapsed={collapsed} onToggleCollapse={e => { e.stopPropagation(); updateNodeData(id, { collapsed: !collapsed }); }}>
      <NodeHeader icon="📋" label={String(d.label || "Fact")} typeLabel="Key Fact" color="#60a5fa" />
      {!collapsed && (
        <>
          {d.relevance && (
            <div style={{ fontSize: 9, color: "#3b82f6", fontWeight: 700, marginBottom: 2 }}>
              {String(d.relevance)}
            </div>
          )}
          <NodeBody text={String(d.content || d.description || "")} />
          <NodeFooter score={score} color="#60a5fa" />
        </>
      )}
    </NodeShell>
  );
});
FactNode.displayName = "FactNode";

// ─── Issue Node ───────────────────────────────────────────────────────────────

export const IssueNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const { updateNodeData } = useReactFlow();
  const d         = data as Record<string, unknown>;
  const collapsed = Boolean(d.collapsed);
  const score     = Number(d.impact_score ?? 80);

  return (
    <NodeShell bgColor="#13082e" borderColor="#9333ea" accentColor="#c084fc"
      selected={selected} isConnectable={isConnectable} score={score}
      collapsed={collapsed} onToggleCollapse={e => { e.stopPropagation(); updateNodeData(id, { collapsed: !collapsed }); }}>
      <NodeHeader icon="🏛️" label={String(d.label || "Legal Issue")} typeLabel="Legal Issue" color="#c084fc" />
      {!collapsed && (
        <>
          <NodeBody text={String(d.description || "")} />
          <NodeFooter score={score} color="#c084fc" />
        </>
      )}
    </NodeShell>
  );
});
IssueNode.displayName = "IssueNode";

// ─── Argument Node ────────────────────────────────────────────────────────────

export const ArgumentNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const { updateNodeData } = useReactFlow();
  const d         = data as Record<string, unknown>;
  const collapsed = Boolean(d.collapsed);
  const score     = Number(d.impact_score ?? 75);
  const strength  = Number(d.strength ?? 75);

  return (
    <NodeShell bgColor="#051f1c" borderColor="#0d9488" accentColor="#2dd4bf"
      selected={selected} isConnectable={isConnectable} score={score}
      collapsed={collapsed} onToggleCollapse={e => { e.stopPropagation(); updateNodeData(id, { collapsed: !collapsed }); }}>
      <NodeHeader icon="🗣️" label={String(d.label || "Argument")} typeLabel="Argument" color="#2dd4bf"
        badge={
          <span style={{ fontSize: 8, fontWeight: 800, color: "#14b8a6", background: "rgba(20,184,166,0.15)", padding: "1px 5px", borderRadius: 6 }}>
            {strength}% strength
          </span>
        }
      />
      {!collapsed && (
        <>
          <NodeBody text={String(d.content || d.description || "")} />
          <NodeFooter score={score} color="#2dd4bf" />
        </>
      )}
    </NodeShell>
  );
});
ArgumentNode.displayName = "ArgumentNode";

// ─── Risk Node ────────────────────────────────────────────────────────────────

export const RiskNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const { updateNodeData } = useReactFlow();
  const d         = data as Record<string, unknown>;
  const collapsed = Boolean(d.collapsed);
  const severity  = Number(d.severity ?? 5);
  const score     = Number(d.impact_score ?? severity * 10);
  const sevColor  = severity >= 8 ? "#ef4444" : severity >= 5 ? "#f97316" : "#eab308";

  return (
    <NodeShell bgColor="#200a0a" borderColor={sevColor} accentColor={sevColor}
      selected={selected} isConnectable={isConnectable} score={score}
      collapsed={collapsed} onToggleCollapse={e => { e.stopPropagation(); updateNodeData(id, { collapsed: !collapsed }); }}>
      <NodeHeader icon="⚠️" label={String(d.label || "Risk")} typeLabel="Risk Factor" color={sevColor}
        badge={
          <span style={{
            fontSize: 8, fontWeight: 800, color: sevColor,
            background: `${sevColor}22`, padding: "1px 5px", borderRadius: 6,
          }}>
            Sev {severity}/10
          </span>
        }
      />
      {!collapsed && (
        <>
          <NodeBody text={String(d.description || "")} />
          <NodeFooter score={score} color={sevColor} extra={
            d.mitigation ? (
              <div style={{ fontSize: 9, color: "#94a3b8" }}>
                💊 {String(d.mitigation)}
              </div>
            ) : undefined
          } />
        </>
      )}
    </NodeShell>
  );
});
RiskNode.displayName = "RiskNode";

// ─── Strategy Node ────────────────────────────────────────────────────────────

export const StrategyNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
  const { updateNodeData } = useReactFlow();
  const d          = data as Record<string, unknown>;
  const collapsed  = Boolean(d.collapsed);
  const score      = Number(d.impact_score ?? 75);
  const confidence = Number(d.confidence ?? 75);

  return (
    <NodeShell bgColor="#1c1100" borderColor="#d97706" accentColor="#fbbf24"
      selected={selected} isConnectable={isConnectable} score={score}
      collapsed={collapsed} onToggleCollapse={e => { e.stopPropagation(); updateNodeData(id, { collapsed: !collapsed }); }}>
      <NodeHeader icon="💡" label={String(d.label || "Strategy")} typeLabel="Strategy" color="#fbbf24"
        badge={
          <span style={{ fontSize: 8, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.15)", padding: "1px 5px", borderRadius: 6 }}>
            {confidence}% conf.
          </span>
        }
      />
      {!collapsed && (
        <>
          <NodeBody text={String(d.description || "")} />
          <NodeFooter score={score} color="#fbbf24" />
        </>
      )}
    </NodeShell>
  );
});
StrategyNode.displayName = "StrategyNode";

// ─── Registry ─────────────────────────────────────────────────────────────────

export const nodeTypes = {
  judgment: JudgmentNode,
  fact:     FactNode,
  issue:    IssueNode,
  argument: ArgumentNode,
  risk:     RiskNode,
  strategy: StrategyNode,
};
