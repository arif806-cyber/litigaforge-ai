import { memo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AgentStatus = "idle" | "thinking" | "done";

export interface AgentState {
  status: AgentStatus;
  text: string;
  reasoning?: string;
  feedback?: "up" | "down" | null;
  askQuestion?: string;
  askResponse?: string;
  askStreaming?: boolean;
  canvasNodeAdded?: boolean;
  consultedBy?: string[];
  agreesWith?: { agentId: string; label: string };
  conflictsWith?: { agentId: string; label: string };
}

export interface CollabEvent {
  from: string;
  to: string;
  message: string;
  timestamp: number;
}

// ─── Agent catalogue ───────────────────────────────────────────────────────────

interface AgentDef {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
  activity: string;
}

const AGENT_DEFS: AgentDef[] = [
  { id: "research",   name: "Research Agent",   emoji: "🔍", role: "Precedent analysis",        color: "#14b8a6", activity: "Scanning Indian Kanoon precedents…"       },
  { id: "strategy",   name: "Strategy Agent",   emoji: "⚡", role: "Legal strategy",            color: "#a855f7", activity: "Developing case strategy…"                },
  { id: "risk",       name: "Risk & Counter",   emoji: "🛡️", role: "Opposition analysis",        color: "#ef4444", activity: "Mapping vulnerabilities & counter-args…" },
  { id: "drafting",   name: "Drafting Agent",   emoji: "✍️", role: "Court-ready drafting",      color: "#3b82f6", activity: "Drafting arguments & prayer clauses…"     },
  { id: "predictive", name: "Predictive Agent", emoji: "🔮", role: "Outcome forecasting",        color: "#f59e0b", activity: "Modeling judicial outcome probabilities…" },
];

const DEF_MAP = Object.fromEntries(AGENT_DEFS.map(d => [d.id, d]));

// ─── Section parsing ───────────────────────────────────────────────────────────

interface Section { title: string; body: string }

const SECTION_KEYS: Record<string, string[]> = {
  research:   ["HOLDINGS", "KEY RATIO", "APPLICABLE STATUTES"],
  strategy:   ["PRIMARY ARGUMENT", "PROCEDURAL ANGLE", "PRAYER CLAUSE"],
  risk:       ["RISK LEVEL", "COUNTER-ARGUMENTS", "ADVERSE PRECEDENTS"],
  drafting:   ["LEGAL CONTENTION", "SUPPORTING AUTHORITIES", "PRAYER"],
  predictive: ["SUCCESS PROBABILITY", "BENCH CONCERNS", "FORUM", "TIMELINE"],
};

function parseAgentSections(text: string, agentId: string): Section[] {
  const keys = SECTION_KEYS[agentId];
  if (!keys?.length) return [];
  if (!keys.some(k => text.includes(k + ":"))) return [];
  const sections: Section[] = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const startIdx = text.indexOf(key + ":");
    if (startIdx === -1) continue;
    const afterHeader = text.slice(startIdx + key.length + 1).trimStart();
    let endIdx = afterHeader.length;
    for (let j = i + 1; j < keys.length; j++) {
      const nextIdx = afterHeader.indexOf(keys[j] + ":");
      if (nextIdx !== -1 && nextIdx < endIdx) endIdx = nextIdx;
    }
    const body = afterHeader.slice(0, endIdx).trim();
    if (body) sections.push({ title: key, body });
  }
  return sections;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FGD = "#64748b";
const FG  = "#e2e8f0";
const BG  = "rgba(8,16,36,0.97)";
const BR  = "rgba(20,184,166,0.12)";

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function AgentAvatar({ def, status }: { def: AgentDef; status: AgentStatus }) {
  const isThinking = status === "thinking";
  const isDone     = status === "done";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {isThinking && (
        <motion.div
          style={{
            position: "absolute", inset: -3, borderRadius: "50%",
            border: `2px solid ${def.color}`,
          }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: `${def.color}18`,
        border: `2px solid ${isDone ? def.color + "99" : isThinking ? def.color + "cc" : def.color + "33"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15,
        boxShadow: isThinking ? `0 0 14px ${def.color}44` : isDone ? `0 0 8px ${def.color}22` : "none",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}>
        {def.emoji}
      </div>
    </div>
  );
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ status, def }: { status: AgentStatus; def: AgentDef }) {
  if (status === "idle") return (
    <span style={{ fontSize: 8.5, color: FGD, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      Standby
    </span>
  );
  if (status === "thinking") return (
    <motion.span
      style={{
        fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
        color: def.color, background: `${def.color}18`,
        padding: "2px 7px", borderRadius: 8,
      }}
      animate={{ opacity: [1, 0.5, 1] }}
      transition={{ duration: 1.4, repeat: Infinity }}
    >
      Working…
    </motion.span>
  );
  return (
    <span style={{
      fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
      color: "#22c55e", background: "rgba(34,197,94,0.12)",
      padding: "2px 7px", borderRadius: 8,
    }}>
      Done ✓
    </span>
  );
}

// ─── AgentCard ────────────────────────────────────────────────────────────────

function AgentCard({
  def,
  state,
  onAskAgent,
  onFeedback,
  onDraftCopy,
  forceAskOpen,
}: {
  def: AgentDef;
  state: AgentState;
  onAskAgent: (agentId: string, question: string) => void;
  onFeedback: (agentId: string, vote: "up" | "down") => void;
  onDraftCopy?: (agentId: string, templateType: string, wordCountBucket: string) => void;
  forceAskOpen?: boolean;
}) {
  const isThinking   = state.status === "thinking";
  const isDone       = state.status === "done";
  const hasContent   = (isThinking || isDone) && (state.text || state.reasoning);
  const sections     = isDone ? parseAgentSections(state.text ?? "", def.id) : [];

  const [showReasoning, setShowReasoning] = useState(false);
  const [askOpen,       setAskOpen]       = useState(false);
  const [askText,       setAskText]       = useState("");

  // When forceAskOpen becomes true, open the inline ask UI
  useEffect(() => {
    if (forceAskOpen) setAskOpen(true);
  }, [forceAskOpen]);

  function submitAsk() {
    const q = askText.trim();
    if (!q) return;
    onAskAgent(def.id, q);
    setAskText("");
  }

  return (
    <motion.div
      layout
      style={{
        background: isThinking
          ? `rgba(${def.color === "#14b8a6" ? "20,184,166" : def.color === "#a855f7" ? "168,85,247" : def.color === "#ef4444" ? "239,68,68" : def.color === "#3b82f6" ? "59,130,246" : "245,158,11"},0.05)`
          : isDone ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.018)",
        border: `1px solid ${isThinking ? def.color + "44" : "rgba(255,255,255,0.055)"}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "background 0.3s, border-color 0.3s",
      }}
    >
      {/* Top accent bar */}
      {(isThinking || isDone) && (
        <div style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${def.color}${isDone ? "88" : "cc"}, transparent)`,
        }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px 8px" }}>
        <AgentAvatar def={def} status={state.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: FG, lineHeight: 1.2 }}>{def.name}</div>
          <div style={{ fontSize: 9.5, color: FGD, marginTop: 1 }}>
            {isThinking ? def.activity : def.role}
          </div>
        </div>
        <StatusChip status={state.status} def={def} />
      </div>

      {/* Reasoning section */}
      <AnimatePresence>
        {isDone && state.reasoning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ margin: "0 12px 4px" }}>
              <button
                onClick={() => setShowReasoning(v => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "none", border: "none", padding: 0,
                  color: FGD, cursor: "pointer", fontSize: 9.5, fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                <span style={{ fontSize: 8, color: def.color }}>{showReasoning ? "▾" : "▸"}</span>
                Reasoning Process
              </button>
              <AnimatePresence>
                {showReasoning && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div style={{
                      marginTop: 5, padding: "7px 9px",
                      background: `${def.color}0c`,
                      border: `1px solid ${def.color}22`,
                      borderRadius: 7,
                      fontSize: 9.5, color: "#94a3b8", fontStyle: "italic", lineHeight: 1.6,
                    }}>
                      {state.reasoning}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streaming / output text */}
      <AnimatePresence>
        {hasContent && state.text && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {sections.length > 0 ? (
              <div style={{
                margin: "4px 12px 6px",
                display: "flex", flexDirection: "column", gap: 7,
                maxHeight: 160, overflowY: "auto",
              }}>
                {sections.map((sec, si) => (
                  <div key={sec.title}>
                    <div style={{
                      fontSize: 8.5, fontWeight: 800, color: def.color,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      marginBottom: 3,
                    }}>
                      {sec.title}
                    </div>
                    <div style={{
                      fontSize: 10, color: "#94a3b8", lineHeight: 1.65,
                      paddingLeft: 8, borderLeft: `3px solid ${def.color}33`,
                      paddingBottom: si < sections.length - 1 ? 5 : 0,
                    }}>
                      {sec.body}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                margin: "4px 12px 6px",
                padding: "8px 10px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: 8,
                fontSize: 10, color: "#94a3b8", lineHeight: 1.65,
                maxHeight: 110, overflowY: "auto",
                wordBreak: "break-word",
              }}>
                {state.text}
                {isThinking && (
                  <motion.span
                    style={{ display: "inline-block", marginLeft: 2, color: def.color }}
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >▌</motion.span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer actions */}
      {isDone && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px 10px", flexWrap: "wrap",
        }}>
          {/* Canvas node badge */}
          {state.canvasNodeAdded && (
            <span style={{
              fontSize: 8.5, fontWeight: 700, color: def.color,
              background: `${def.color}15`, border: `1px solid ${def.color}33`,
              padding: "2px 7px", borderRadius: 8, display: "flex", alignItems: "center", gap: 3,
            }}>
              ⊕ Canvas
            </span>
          )}

          {/* Agree/Disagree badges */}
          {state.agreesWith && (
            <span style={{
              fontSize: 8.5, fontWeight: 700, color: "#22c55e",
              background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
              padding: "2px 7px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 3,
            }}
              title={state.agreesWith.label}
            >
              ✓ {DEF_MAP[state.agreesWith.agentId]?.name ?? state.agreesWith.agentId}
            </span>
          )}
          {state.conflictsWith && (
            <span style={{
              fontSize: 8.5, fontWeight: 700, color: "#f59e0b",
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
              padding: "2px 7px", borderRadius: 8,
              display: "flex", alignItems: "center", gap: 3,
            }}
              title={state.conflictsWith.label}
            >
              ⚡ {DEF_MAP[state.conflictsWith.agentId]?.name ?? state.conflictsWith.agentId}
            </span>
          )}

          {/* Feedback */}
          <button
            onClick={() => onFeedback(def.id, "up")}
            style={{
              background: state.feedback === "up" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${state.feedback === "up" ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6, padding: "3px 7px", cursor: "pointer",
              fontSize: 11, color: state.feedback === "up" ? "#22c55e" : FGD,
              transition: "all 0.15s",
            }}
            title="Helpful"
          >👍</button>
          <button
            onClick={() => onFeedback(def.id, "down")}
            style={{
              background: state.feedback === "down" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${state.feedback === "down" ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6, padding: "3px 7px", cursor: "pointer",
              fontSize: 11, color: state.feedback === "down" ? "#ef4444" : FGD,
              transition: "all 0.15s",
            }}
            title="Not helpful"
          >👎</button>

          {/* Ask toggle */}
          <button
            onClick={() => setAskOpen(v => !v)}
            style={{
              marginLeft: "auto",
              background: askOpen ? `${def.color}18` : "rgba(255,255,255,0.05)",
              border: `1px solid ${askOpen ? def.color + "44" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6, padding: "3px 9px",
              fontSize: 9, fontWeight: 700, color: askOpen ? def.color : FGD,
              cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.03em",
            }}
          >
            {askOpen ? "✕ Close" : "💬 Ask"}
          </button>

          {/* Step 5: Copy draft — drafting agent only, emits template_type + word_count_bucket */}
          {def.id === "drafting" && state.text && onDraftCopy && (
            <button
              onClick={() => {
                void navigator.clipboard.writeText(state.text ?? "").catch(() => {});
                const wc = (state.text ?? "").split(/\s+/).filter(Boolean).length;
                const wcb = wc < 200 ? "short" : wc < 500 ? "medium" : "long";
                const templateType = sections[0]?.title ?? "full";
                onDraftCopy(def.id, templateType, wcb);
              }}
              style={{
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.25)",
                borderRadius: 6, padding: "3px 9px",
                fontSize: 9, fontWeight: 700, color: "#93c5fd",
                cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.03em",
              }}
              title="Copy draft to clipboard — tracked for style learning"
            >
              📋 Copy
            </button>
          )}
        </div>
      )}

      {/* Inline ask interface — shown when done+askOpen, OR when externally force-opened */}
      <AnimatePresence>
        {(isDone || forceAskOpen) && askOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              padding: "10px 12px",
              background: `${def.color}07`,
            }}>
              <div style={{ fontSize: 9.5, color: def.color, fontWeight: 700, marginBottom: 7, letterSpacing: "0.04em" }}>
                Direct question to {def.name}:
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={askText}
                  onChange={e => setAskText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitAsk()}
                  placeholder="Ask anything about this analysis…"
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${def.color}33`,
                    borderRadius: 7, padding: "6px 9px",
                    fontSize: 10, color: FG, outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={submitAsk}
                  disabled={!askText.trim() || state.askStreaming}
                  style={{
                    padding: "6px 10px", borderRadius: 7, border: "none",
                    background: askText.trim() && !state.askStreaming ? def.color : "rgba(255,255,255,0.06)",
                    color: askText.trim() && !state.askStreaming ? "#fff" : FGD,
                    fontWeight: 700, fontSize: 11, cursor: askText.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.15s", flexShrink: 0,
                  }}
                >→</button>
              </div>

              {/* Ask response */}
              {(state.askResponse || state.askStreaming) && (
                <div style={{
                  marginTop: 8, padding: "7px 9px",
                  background: "rgba(0,0,0,0.2)", borderRadius: 7,
                  fontSize: 10, color: "#cbd5e1", lineHeight: 1.65,
                }}>
                  {state.askResponse || ""}
                  {state.askStreaming && (
                    <motion.span
                      style={{ display: "inline-block", marginLeft: 2, color: def.color }}
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >▌</motion.span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Collaboration Timeline ───────────────────────────────────────────────────

function CollabTimeline({ feed }: { feed: CollabEvent[] }) {
  if (feed.length === 0) return null;
  return (
    <div style={{
      margin: "8px 10px 4px",
      padding: "10px 12px",
      background: "rgba(20,184,166,0.04)",
      border: "1px solid rgba(20,184,166,0.1)",
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "#0d9488", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
        ⟳ Agent Collaboration
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {feed.slice(-5).map((ev, i) => {
          const fromDef  = DEF_MAP[ev.from];
          const toDef    = DEF_MAP[ev.to];
          const lineColor = fromDef?.color ?? "#14b8a6";
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              style={{ display: "flex", alignItems: "stretch", gap: 8 }}
            >
              {/* Left accent line (timeline marker) */}
              <div style={{
                width: 3, flexShrink: 0,
                background: `${lineColor}66`,
                borderRadius: 2,
                minHeight: 32,
              }} />
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                <div style={{ fontSize: 9, color: lineColor, fontWeight: 700, marginBottom: 2 }}>
                  {fromDef?.emoji ?? "🤖"}{fromDef?.name ? ` ${fromDef.name}` : ""} → {toDef?.emoji ?? "🤖"}
                </div>
                <div style={{ fontSize: 9.5, color: "#94a3b8", lineHeight: 1.5 }}>
                  {ev.message}
                </div>
                <div style={{ fontSize: 8.5, color: "#475569", marginTop: 1 }}>
                  {timeAgo(ev.timestamp)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Synthesis Banner ─────────────────────────────────────────────────────────

function SynthesisBanner({ score }: { score: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: "8px 10px 4px",
        padding: "10px 14px",
        background: "linear-gradient(135deg, rgba(20,184,166,0.12), rgba(168,85,247,0.08))",
        border: "1px solid rgba(20,184,166,0.25)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 10.5, color: "#14b8a6", marginBottom: 3 }}>
        ✦ Agent Society — Consensus Reached
      </div>
      <div style={{ fontSize: 9.5, color: "#94a3b8", lineHeight: 1.5 }}>
        All 5 specialists have completed their analysis. Review each agent's findings above.
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ height: "100%", background: "linear-gradient(90deg, #0d9488, #a855f7)", borderRadius: 4 }}
          />
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: "#14b8a6", flexShrink: 0 }}>{score}% consensus</span>
      </div>
    </motion.div>
  );
}

// ─── AgentPanel ───────────────────────────────────────────────────────────────

interface AgentPanelProps {
  agentStates:            Record<string, AgentState>;
  isAnalyzing:            boolean;
  onAnalyze:              () => void;
  caseDescription:        string;
  onCaseDescriptionChange:(val: string) => void;
  collabFeed:             CollabEvent[];
  onAskAgent:             (agentId: string, question: string) => void;
  onFeedback:             (agentId: string, vote: "up" | "down") => void;
  onDraftCopy?:           (agentId: string, templateType: string, wordCountBucket: string) => void;
  synthesisScore?:        number;
  openAskFor?:            string;
}

const AgentPanel = memo(({
  agentStates,
  isAnalyzing,
  onAnalyze,
  caseDescription,
  onCaseDescriptionChange,
  collabFeed,
  onAskAgent,
  onFeedback,
  onDraftCopy,
  synthesisScore,
  openAskFor,
}: AgentPanelProps) => {
  const doneCount = Object.values(agentStates).filter(s => s.status === "done").length;
  const allDone   = doneCount === AGENT_DEFS.length;
  const progress  = doneCount > 0 ? Math.round((doneCount / AGENT_DEFS.length) * 100) : 0;
  const activeAgent = AGENT_DEFS.find(d => agentStates[d.id]?.status === "thinking");

  return (
    <div style={{
      width: 310, flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: BG,
      borderRight: `1px solid ${BR}`,
      overflowY: "auto",
    }}>
      {/* ── Panel header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: "14px 14px 10px",
        borderBottom: `1px solid rgba(255,255,255,0.06)`,
        flexShrink: 0,
      }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "rgba(20,184,166,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12.5, color: FG }}>Agent Society</div>
            <div style={{ fontSize: 9.5, color: FGD }}>5 specialized legal AI minds</div>
          </div>
        </div>

        {/* Progress bar */}
        {(isAnalyzing || doneCount > 0) && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 9, color: FGD, marginBottom: 5,
            }}>
              <span>{activeAgent ? `${activeAgent.emoji} ${activeAgent.name} working…` : allDone ? "✦ All agents done" : "Preparing…"}</span>
              <span style={{ fontWeight: 700, color: allDone ? "#22c55e" : "#14b8a6" }}>{doneCount}/{AGENT_DEFS.length}</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <motion.div
                style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, #0d9488, #14b8a6)" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}

        {/* Case description */}
        <textarea
          value={caseDescription}
          onChange={e => onCaseDescriptionChange(e.target.value)}
          placeholder="Describe your case for the agents…"
          rows={3}
          style={{
            width: "100%", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "8px 10px",
            fontSize: 10.5, color: FG, resize: "none", outline: "none",
            boxSizing: "border-box", lineHeight: 1.5, fontFamily: "inherit",
          }}
        />

        {/* Analyze button */}
        <motion.button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          whileTap={!isAnalyzing ? { scale: 0.97 } : undefined}
          style={{
            width: "100%", marginTop: 8, padding: "10px 0",
            borderRadius: 8, border: "none",
            background: isAnalyzing
              ? "rgba(20,184,166,0.1)"
              : "linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #0d9488 100%)",
            backgroundSize: "200% 200%",
            color: isAnalyzing ? "#14b8a6" : "#fff",
            fontWeight: 800, fontSize: 11.5,
            cursor: isAnalyzing ? "not-allowed" : "pointer",
            letterSpacing: "0.04em",
            boxShadow: isAnalyzing ? "none" : "0 4px 20px rgba(13,148,136,0.35)",
          }}
        >
          {isAnalyzing ? "⟳  Agents Working…" : "▶  Run Agent Analysis"}
        </motion.button>
      </div>

      {/* ── Agent cards ───────────────────────────────────────────────────── */}
      <div style={{ padding: "10px 10px 4px", display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
        {AGENT_DEFS.map(def => (
          <AgentCard
            key={def.id}
            def={def}
            state={agentStates[def.id] ?? { status: "idle", text: "" }}
            onAskAgent={onAskAgent}
            onFeedback={onFeedback}
            onDraftCopy={onDraftCopy}
            forceAskOpen={openAskFor === def.id}
          />
        ))}
      </div>

      {/* ── Collaboration timeline ────────────────────────────────────────── */}
      <CollabTimeline feed={collabFeed} />

      {/* ── Synthesis banner ──────────────────────────────────────────────── */}
      {allDone && synthesisScore != null && (
        <div style={{ padding: "0 0 4px" }}>
          <SynthesisBanner score={synthesisScore} />
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
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
