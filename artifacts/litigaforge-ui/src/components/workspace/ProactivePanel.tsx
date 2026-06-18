import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Suggestion {
  id: string;
  type: "opportunity" | "risk" | "precedent" | "pattern" | "warning" | "agent_rec" | "cross_matter" | "step" | "framework";
  emoji: string;
  text: string;
  detail?: string;
  sessionId?: number;
}

interface ProactivePanelProps {
  suggestions:    Suggestion[];
  isLoading:      boolean;
  canvasHasNodes: boolean;
  sessionReady:   boolean;
  onRefresh:      () => void;
  onAccept:       (s: Suggestion) => void;
  onDismiss:      (id: string)    => void;
}

// ─── Config ────────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { color: string; label: string; acceptLabel?: string }> = {
  opportunity:  { color: "#14b8a6", label: "Opportunity"      },
  risk:         { color: "#ef4444", label: "Risk Detected"    },
  precedent:    { color: "#3b82f6", label: "Precedent"        },
  pattern:      { color: "#a855f7", label: "Pattern Found"    },
  warning:      { color: "#f59e0b", label: "Missing Info"     },
  agent_rec:    { color: "#f97316", label: "Ask an Agent",    acceptLabel: "→ Ask Agent"     },
  cross_matter: { color: "#6366f1", label: "Similar Matter",  acceptLabel: "→ Open Matter"   },
  step:         { color: "#22c55e", label: "Action Step",     acceptLabel: "✓ Add to Canvas" },
  framework:    { color: "#eab308", label: "Legal Framework", acceptLabel: "✓ Add Framework" },
};

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <motion.div
      style={{
        height: 72, borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      animate={{ opacity: [0.35, 0.65, 0.35] }}
      transition={{ duration: 1.6, repeat: Infinity, delay }}
    />
  );
}

// ─── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({
  s,
  onAccept,
  onDismiss,
}: {
  s: Suggestion;
  onAccept: (s: Suggestion) => void;
  onDismiss: (id: string)   => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[s.type] ?? TYPE_META.opportunity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0, padding: 0, overflow: "hidden" }}
      transition={{ duration: 0.22 }}
      style={{
        background: `${meta.color}09`,
        border: `1px solid ${meta.color}28`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Top accent line */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent, ${meta.color}77, transparent)`,
      }} />

      <div style={{ padding: "10px 12px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{s.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 8, fontWeight: 800, letterSpacing: "0.07em",
              color: meta.color, textTransform: "uppercase", marginBottom: 3,
            }}>
              {meta.label}
            </div>
            <div style={{ fontSize: 10.5, color: "#cbd5e1", lineHeight: 1.55 }}>
              {s.text}
            </div>
          </div>
          <button
            onClick={() => onDismiss(s.id)}
            style={{
              background: "none", border: "none", color: "#475569",
              cursor: "pointer", fontSize: 11, padding: "2px 4px", flexShrink: 0,
              lineHeight: 1,
            }}
            title="Dismiss"
          >✕</button>
        </div>

        {/* Expandable detail */}
        <AnimatePresence>
          {expanded && s.detail && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div style={{
                padding: "7px 9px",
                background: "rgba(0,0,0,0.18)",
                borderRadius: 7,
                marginBottom: 8,
                fontSize: 9.5, color: "#94a3b8", lineHeight: 1.65, fontStyle: "italic",
              }}>
                {s.detail}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div style={{ display: "flex", gap: 5 }}>
          <button
            onClick={() => onAccept(s)}
            style={{
              flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer",
              background: `${meta.color}16`, border: `1px solid ${meta.color}3a`,
              color: meta.color, fontSize: 9.5, fontWeight: 700,
              transition: "background 0.15s",
            }}
          >{meta.acceptLabel ?? "✓ Accept"}</button>
          {s.detail && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                padding: "5px 11px", borderRadius: 6, cursor: "pointer",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                color: "#94a3b8", fontSize: 9.5, fontWeight: 700,
              }}
            >
              {expanded ? "▲" : "Detail"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── ProactivePanel ────────────────────────────────────────────────────────────

export default function ProactivePanel({
  suggestions,
  isLoading,
  canvasHasNodes,
  sessionReady,
  onRefresh,
  onAccept,
  onDismiss,
}: ProactivePanelProps) {
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#14b8a6", letterSpacing: "0.04em" }}>
            ✦ Proactive Intelligence
          </div>
          <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>
            AI scans your canvas for insights
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading || !sessionReady}
          style={{
            background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.2)",
            borderRadius: 7, padding: "5px 10px",
            cursor: (isLoading || !sessionReady) ? "not-allowed" : "pointer",
            fontSize: 9.5, fontWeight: 700, color: "#14b8a6",
            opacity: (isLoading || !sessionReady) ? 0.5 : 1,
            flexShrink: 0, marginLeft: 6,
          }}
        >
          {isLoading ? "⟳" : "↻ Refresh"}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <SkeletonCard delay={0} />
          <SkeletonCard delay={0.2} />
          <SkeletonCard delay={0.4} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && suggestions.length === 0 && (
        <div style={{
          textAlign: "center", padding: "22px 14px",
          background: "rgba(255,255,255,0.02)", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.6 }}>🔭</div>
          <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.7 }}>
            {!sessionReady
              ? "Open or create a workspace session first."
              : !canvasHasNodes
              ? "Add nodes to the canvas, then click ↻ Refresh to get AI insights."
              : "Click ↻ Refresh to generate proactive suggestions."}
          </div>
        </div>
      )}

      {/* Suggestion cards */}
      <AnimatePresence mode="popLayout">
        {!isLoading && suggestions.map(s => (
          <SuggestionCard
            key={s.id}
            s={s}
            onAccept={onAccept}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>

      {/* Footer */}
      {!isLoading && suggestions.length > 0 && (
        <p style={{ fontSize: 9, color: "#334155", margin: 0, lineHeight: 1.5 }}>
          Insights refresh automatically after agent analysis completes.
        </p>
      )}
    </div>
  );
}
