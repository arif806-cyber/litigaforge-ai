import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type AgentStatus = "idle" | "thinking" | "done";

export interface AgentState {
  status: AgentStatus;
  text: string;
}

interface AgentDef {
  id: string;
  name: string;
  emoji: string;
  role: string;
}

const AGENT_DEFS: AgentDef[] = [
  { id: "research",  name: "Research Agent",     emoji: "🔍", role: "Precedent analysis"          },
  { id: "strategy",  name: "Strategy Agent",     emoji: "⚡", role: "Legal strategy"              },
  { id: "risk",      name: "Risk & Counter",     emoji: "🛡️", role: "Opposition analysis"        },
  { id: "drafting",  name: "Drafting Agent",     emoji: "✍️", role: "Argument drafting"          },
  { id: "predictive",name: "Predictive Agent",   emoji: "🔮", role: "Court outcome forecasting"  },
];

function StatusDot({ status }: { status: AgentStatus }) {
  if (status === "idle") {
    return (
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: "rgba(148,163,184,0.3)",
        flexShrink: 0,
      }} />
    );
  }
  if (status === "thinking") {
    return (
      <motion.div
        style={{ width: 8, height: 8, borderRadius: "50%", background: "#14b8a6", flexShrink: 0 }}
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
    );
  }
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0,
    }} />
  );
}

function AgentCard({
  def,
  state,
}: {
  def: AgentDef;
  state: AgentState;
}) {
  const isThinking = state.status === "thinking";
  const isDone     = state.status === "done";
  const hasText    = (isThinking || isDone) && state.text;

  return (
    <motion.div
      layout
      style={{
        background: isThinking
          ? "rgba(20,184,166,0.07)"
          : isDone
          ? "rgba(34,197,94,0.04)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${isThinking ? "rgba(20,184,166,0.25)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 10,
        padding: "10px 12px",
        transition: "background 0.3s, border-color 0.3s",
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusDot status={state.status} />
        <span style={{ fontSize: 15 }}>{def.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "#e2e8f0", lineHeight: 1.2 }}>
            {def.name}
          </div>
          <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 1 }}>{def.role}</div>
        </div>
        {isDone && (
          <div style={{
            fontSize: 9, color: "#22c55e", background: "rgba(34,197,94,0.12)",
            padding: "2px 6px", borderRadius: 4, fontWeight: 700, flexShrink: 0,
          }}>
            Done
          </div>
        )}
        {isThinking && (
          <div style={{
            fontSize: 9, color: "#14b8a6", background: "rgba(20,184,166,0.12)",
            padding: "2px 6px", borderRadius: 4, fontWeight: 700, flexShrink: 0,
          }}>
            Working…
          </div>
        )}
      </div>

      {/* Streaming text */}
      <AnimatePresence>
        {hasText && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "rgba(0,0,0,0.25)",
              borderRadius: 6,
              fontSize: 10,
              color: "#94a3b8",
              lineHeight: 1.6,
              maxHeight: 120,
              overflowY: "auto",
              wordBreak: "break-word",
            }}>
              {state.text}
              {isThinking && (
                <motion.span
                  style={{ display: "inline-block", marginLeft: 2, color: "#14b8a6" }}
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  ▌
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface AgentPanelProps {
  agentStates: Record<string, AgentState>;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  caseDescription: string;
  onCaseDescriptionChange: (val: string) => void;
}

const AgentPanel = memo(({
  agentStates,
  isAnalyzing,
  onAnalyze,
  caseDescription,
  onCaseDescriptionChange,
}: AgentPanelProps) => {
  const doneCount = Object.values(agentStates).filter(s => s.status === "done").length;
  const progress  = isAnalyzing || doneCount > 0 ? Math.round((doneCount / AGENT_DEFS.length) * 100) : 0;

  return (
    <div style={{
      width: 272,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "rgba(8,16,36,0.97)",
      borderRight: "1px solid rgba(20,184,166,0.12)",
      overflowY: "auto",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "14px 14px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(20,184,166,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12, color: "#e2e8f0" }}>Agent Society</div>
            <div style={{ fontSize: 9.5, color: "#64748b" }}>5 AI specialists</div>
          </div>
        </div>

        {/* Case description input */}
        <textarea
          value={caseDescription}
          onChange={e => onCaseDescriptionChange(e.target.value)}
          placeholder="Describe your case for the agents…"
          rows={3}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 10.5,
            color: "#e2e8f0",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
            lineHeight: 1.5,
            fontFamily: "inherit",
          }}
        />

        {/* Analyze button */}
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "9px 0",
            borderRadius: 8,
            border: "none",
            background: isAnalyzing
              ? "rgba(20,184,166,0.12)"
              : "linear-gradient(135deg, #0d9488, #14b8a6)",
            color: isAnalyzing ? "#14b8a6" : "#fff",
            fontWeight: 700,
            fontSize: 11,
            cursor: isAnalyzing ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            letterSpacing: "0.03em",
          }}
        >
          {isAnalyzing ? "Analyzing…" : "▶ Run Agent Analysis"}
        </button>

        {/* Progress bar */}
        {(isAnalyzing || doneCount > 0) && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 9, color: "#64748b", marginBottom: 4,
            }}>
              <span>Progress</span>
              <span>{doneCount}/{AGENT_DEFS.length} agents</span>
            </div>
            <div style={{
              height: 3, borderRadius: 2,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}>
              <motion.div
                style={{ height: "100%", borderRadius: 2, background: "#14b8a6" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Agent cards */}
      <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {AGENT_DEFS.map(def => (
          <AgentCard
            key={def.id}
            def={def}
            state={agentStates[def.id] ?? { status: "idle", text: "" }}
          />
        ))}
      </div>

      {/* Footer note */}
      <div style={{
        padding: "10px 14px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        <p style={{ fontSize: 9, color: "#475569", lineHeight: 1.5, margin: 0 }}>
          AI outputs are for research purposes only. Always verify with qualified counsel.
        </p>
      </div>
    </div>
  );
});
AgentPanel.displayName = "AgentPanel";

export default AgentPanel;
