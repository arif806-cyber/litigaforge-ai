import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function ImpactRing({ score }: { score: number }) {
  const r = 11;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(100, Math.max(0, score)) / 100 * circ;
  return (
    <svg width="28" height="28" className="flex-shrink-0">
      <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <circle cx="14" cy="14" r={r} fill="none" stroke="currentColor" strokeWidth="2"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 14 14)" style={{ transition: "stroke-dasharray 0.5s ease" }} />
      <text x="14" y="18" textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="700">
        {score}
      </text>
    </svg>
  );
}

function NodeShell({
  children,
  borderColor,
  bgColor,
  accentColor,
  selected,
  isConnectable,
}: {
  children: React.ReactNode;
  borderColor: string;
  bgColor: string;
  accentColor: string;
  selected?: boolean;
  isConnectable?: boolean;
}) {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable}
        style={{ background: accentColor, border: "none", width: 8, height: 8, left: -5 }} />
      <div style={{
        background: bgColor,
        border: `1.5px solid ${selected ? accentColor : borderColor}`,
        borderRadius: 10,
        minWidth: 200,
        maxWidth: 260,
        padding: "10px 12px",
        boxShadow: selected
          ? `0 0 0 2px ${accentColor}44, 0 8px 32px rgba(0,0,0,0.6)`
          : "0 4px 20px rgba(0,0,0,0.5)",
        transition: "box-shadow 0.2s, border-color 0.2s",
      }}>
        {children}
      </div>
      <Handle type="source" position={Position.Right} isConnectable={isConnectable}
        style={{ background: accentColor, border: "none", width: 8, height: 8, right: -5 }} />
    </>
  );
}

function NodeHeader({ icon, label, typeLabel, color }: {
  icon: string; label: string; typeLabel: string; color: string;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
          color, opacity: 0.9,
        }}>{typeLabel}</span>
      </div>
      <div style={{
        fontWeight: 700, fontSize: 12.5, color: "#e2e8f0", lineHeight: 1.3,
        wordBreak: "break-word",
      }}>
        {label}
      </div>
    </div>
  );
}

function NodeBody({ text, color }: { text?: string; color: string }) {
  if (!text) return null;
  return (
    <p style={{
      fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5,
      overflow: "hidden", display: "-webkit-box",
      WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
      marginTop: 4, marginBottom: 0,
    }}>{text}</p>
  );
}

function NodeFooter({ score, extra, color }: { score?: number; extra?: React.ReactNode; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginTop: 8, paddingTop: 6,
      borderTop: "1px solid rgba(255,255,255,0.06)",
    }}>
      {extra}
      {score !== undefined && (
        <div style={{ color, marginLeft: "auto" }}>
          <ImpactRing score={score} />
        </div>
      )}
    </div>
  );
}

// ─── Judgment Node ─────────────────────────────────────────────────────────────

export const JudgmentNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const d = data as Record<string, unknown>;
  return (
    <NodeShell bgColor="#0c1c3d" borderColor="#0d9488" accentColor="#14b8a6"
      selected={selected} isConnectable={isConnectable}>
      <NodeHeader icon="⚖️" label={String(d.label || "Judgment")} typeLabel="Precedent" color="#14b8a6" />
      {d.court && (
        <div style={{
          fontSize: 9.5, color: "#64748b", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3,
        }}>{String(d.court)} {d.year ? `· ${d.year}` : ""}</div>
      )}
      {d.citation && (
        <div style={{ fontSize: 9, color: "#0d9488", fontWeight: 600, marginBottom: 2 }}>
          {String(d.citation)}
        </div>
      )}
      <NodeBody text={String(d.summary || "")} color="#14b8a6" />
      <NodeFooter score={Number(d.impact_score || 75)} color="#14b8a6" extra={
        d.url ? (
          <a href={String(d.url)} target="_blank" rel="noreferrer"
            style={{ fontSize: 9, color: "#0d9488", textDecoration: "none", fontWeight: 600 }}
            onClick={e => e.stopPropagation()}>
            View →
          </a>
        ) : undefined
      } />
    </NodeShell>
  );
});
JudgmentNode.displayName = "JudgmentNode";

// ─── Fact Node ────────────────────────────────────────────────────────────────

export const FactNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const d = data as Record<string, unknown>;
  return (
    <NodeShell bgColor="#0a1628" borderColor="#3b82f6" accentColor="#60a5fa"
      selected={selected} isConnectable={isConnectable}>
      <NodeHeader icon="📋" label={String(d.label || "Fact")} typeLabel="Key Fact" color="#60a5fa" />
      <NodeBody text={String(d.content || d.description || "")} color="#60a5fa" />
      <NodeFooter score={Number(d.impact_score || 70)} color="#60a5fa" extra={
        d.relevance ? (
          <span style={{ fontSize: 9, color: "#3b82f6", fontWeight: 600 }}>
            {String(d.relevance)}
          </span>
        ) : undefined
      } />
    </NodeShell>
  );
});
FactNode.displayName = "FactNode";

// ─── Issue Node ───────────────────────────────────────────────────────────────

export const IssueNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const d = data as Record<string, unknown>;
  return (
    <NodeShell bgColor="#1a0f3d" borderColor="#a855f7" accentColor="#c084fc"
      selected={selected} isConnectable={isConnectable}>
      <NodeHeader icon="⚖️" label={String(d.label || "Legal Issue")} typeLabel="Legal Issue" color="#c084fc" />
      <NodeBody text={String(d.description || "")} color="#c084fc" />
      <NodeFooter score={Number(d.impact_score || 80)} color="#c084fc" />
    </NodeShell>
  );
});
IssueNode.displayName = "IssueNode";

// ─── Argument Node ────────────────────────────────────────────────────────────

export const ArgumentNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const d = data as Record<string, unknown>;
  const strength = Number(d.strength || 75);
  return (
    <NodeShell bgColor="#0a2624" borderColor="#14b8a6" accentColor="#2dd4bf"
      selected={selected} isConnectable={isConnectable}>
      <NodeHeader icon="🗣️" label={String(d.label || "Argument")} typeLabel="Argument" color="#2dd4bf" />
      <NodeBody text={String(d.content || d.description || "")} color="#2dd4bf" />
      <NodeFooter score={Number(d.impact_score || strength)} color="#2dd4bf" extra={
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <div style={{
            width: 48, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${strength}%`, background: "#14b8a6",
              borderRadius: 2, transition: "width 0.5s",
            }} />
          </div>
          <span style={{ fontSize: 9, color: "#14b8a6", fontWeight: 600 }}>{strength}%</span>
        </div>
      } />
    </NodeShell>
  );
});
ArgumentNode.displayName = "ArgumentNode";

// ─── Risk Node ────────────────────────────────────────────────────────────────

export const RiskNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const d = data as Record<string, unknown>;
  const severity = Number(d.severity || 5);
  const sevColor = severity >= 8 ? "#ef4444" : severity >= 5 ? "#f97316" : "#eab308";
  return (
    <NodeShell bgColor="#2d0a0a" borderColor={sevColor} accentColor={sevColor}
      selected={selected} isConnectable={isConnectable}>
      <NodeHeader icon="⚠️" label={String(d.label || "Risk")} typeLabel="Risk Factor" color={sevColor} />
      <NodeBody text={String(d.description || "")} color={sevColor} />
      <NodeFooter score={Number(d.impact_score || severity * 10)} color={sevColor} extra={
        <div style={{
          fontSize: 9, fontWeight: 700, color: sevColor,
          background: `${sevColor}22`, padding: "2px 6px", borderRadius: 4,
        }}>
          Severity {severity}/10
        </div>
      } />
    </NodeShell>
  );
});
RiskNode.displayName = "RiskNode";

// ─── Strategy Node ────────────────────────────────────────────────────────────

export const StrategyNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const d = data as Record<string, unknown>;
  const confidence = Number(d.confidence || 75);
  return (
    <NodeShell bgColor="#1f1500" borderColor="#f59e0b" accentColor="#fbbf24"
      selected={selected} isConnectable={isConnectable}>
      <NodeHeader icon="💡" label={String(d.label || "Strategy")} typeLabel="Strategy" color="#fbbf24" />
      <NodeBody text={String(d.description || "")} color="#fbbf24" />
      <NodeFooter score={Number(d.impact_score || confidence)} color="#fbbf24" extra={
        <div style={{
          fontSize: 9, color: "#f59e0b", fontWeight: 600,
          background: "rgba(245,158,11,0.15)", padding: "2px 6px", borderRadius: 4,
        }}>
          {confidence}% confidence
        </div>
      } />
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
