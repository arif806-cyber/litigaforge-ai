import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Node } from "@xyflow/react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NodeDelta {
  nodeLabel: string;
  oldScore:  number;
  newScore:  number;
  reason:    string;
}

export interface SimBefore {
  avgScore:  number;
  riskLevel: string;
  nodeCount: number;
}

export interface SimAfter {
  avgScore:      number;
  riskLevel:     string;
  scoreChange:   number;
  summary:       string;
  recommendation:string;
}

export interface SimulationResult {
  id:         string;
  scenario:   string;
  timestamp:  number;
  before:     SimBefore;
  after:      SimAfter;
  deltas:     NodeDelta[];
}

export interface SimState {
  phase:      "idle" | "running" | "complete";
  scenario:   string;
  before:     SimBefore  | null;
  after:      SimAfter   | null;
  deltas:     NodeDelta[];
  analysis:   string;
  agents:     string[];
}

interface SimulationPanelProps {
  nodes:             Node[];
  simState:          SimState;
  simHistory:        SimulationResult[];
  onRunSimulation:   (assumption: string) => void;
  onSaveSimulation:  () => void;
  onApplyToCanvas:   (result: SimulationResult) => void;
}

// ─── Config ────────────────────────────────────────────────────────────────────

const QUICK_SCENARIOS = [
  "Assume the key judgment is distinguished by the court",
  "Assume this main argument is rejected and alternatives needed",
  "What if a contradictory precedent emerges in next 6 months?",
  "What if we adopt a more aggressive, confrontational litigation strategy?",
  "What if the matter is resolved through negotiated settlement instead?",
];

const RISK_COLORS: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#22c55e",
};

const AGENT_DEFS: Record<string, { name: string; emoji: string }> = {
  risk:     { name: "Risk & Counter Agent", emoji: "🛡️" },
  strategy: { name: "Strategy Agent",       emoji: "⚡" },
};

// ─── Small helpers ─────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const color = RISK_COLORS[level] ?? "#64748b";
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
      textTransform: "uppercase" as const,
      color, background: `${color}18`,
      border: `1px solid ${color}33`,
      padding: "2px 7px", borderRadius: 6,
    }}>
      {level} risk
    </span>
  );
}

function ScoreDeltaBar({ delta }: { delta: NodeDelta }) {
  const change  = delta.newScore - delta.oldScore;
  const isUp    = change > 0;
  const color   = isUp ? "#22c55e" : "#ef4444";
  const absChg  = Math.abs(change);
  const barOld  = Math.min(100, delta.oldScore);
  const barNew  = Math.min(100, delta.newScore);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 9.5, color: "#94a3b8", maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {delta.nodeLabel}
        </span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color, flexShrink: 0 }}>
          {delta.oldScore}→{delta.newScore} <span style={{ fontSize: 8 }}>({isUp ? "+" : ""}{change})</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        {/* Old bar */}
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${barOld}%`, background: "rgba(255,255,255,0.12)", borderRadius: 4 }} />
        {/* New bar */}
        <motion.div
          initial={{ width: `${barOld}%` }}
          animate={{ width: `${barNew}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ position: "absolute", left: 0, top: 0, height: "100%", background: color, borderRadius: 4, opacity: 0.8 }}
        />
      </div>
      <div style={{ fontSize: 8.5, color: "#475569", marginTop: 2 }}>{delta.reason}</div>
    </div>
  );
}

// ─── SimulationPanel ───────────────────────────────────────────────────────────

export default function SimulationPanel({
  nodes,
  simState,
  simHistory,
  onRunSimulation,
  onSaveSimulation,
  onApplyToCanvas,
}: SimulationPanelProps) {
  const [customInput, setCustomInput] = useState("");
  const isRunning = simState.phase === "running";
  const isDone    = simState.phase === "complete";
  const hasBefore = !!simState.before;

  function handleRun(assumption: string) {
    if (!assumption.trim() || isRunning) return;
    onRunSimulation(assumption.trim());
    setCustomInput("");
  }

  // Find corresponding simulation in history for "Apply to Canvas"
  const lastResult: SimulationResult | null = simHistory.length > 0 ? simHistory[simHistory.length - 1] : null;
  const canApply = isDone && lastResult && !simHistory.slice(0, -1).some(h => h.id === lastResult?.id);

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.04em" }}>
          ⚡ What-If Simulation Engine
        </div>
        <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 2 }}>
          Test assumptions — see how your strategy shifts
        </div>
      </div>

      {/* Quick scenarios */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
          Quick scenarios
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {QUICK_SCENARIOS.map(s => (
            <button
              key={s}
              onClick={() => handleRun(s)}
              disabled={isRunning}
              style={{
                textAlign: "left" as const,
                padding: "7px 10px", borderRadius: 7,
                background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)",
                color: "#cbd5e1", fontSize: 9.5, lineHeight: 1.4,
                cursor: isRunning ? "not-allowed" : "pointer",
                opacity: isRunning ? 0.5 : 1,
                transition: "background 0.15s",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Custom input */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
          Custom assumption
        </div>
        <textarea
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRun(customInput);
          }}
          placeholder="e.g. What if the opposing party produces new documentary evidence?"
          rows={3}
          style={{
            width: "100%", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
            padding: "8px 10px", fontSize: 10.5, color: "#e2e8f0",
            resize: "none" as const, outline: "none", boxSizing: "border-box" as const,
            fontFamily: "inherit", lineHeight: 1.55,
          }}
        />
        <button
          onClick={() => handleRun(customInput)}
          disabled={isRunning || !customInput.trim()}
          style={{
            width: "100%", marginTop: 7, padding: "9px 0",
            borderRadius: 8, border: "none",
            background: isRunning ? "rgba(245,158,11,0.08)" : (customInput.trim() ? "linear-gradient(135deg, #d97706, #f59e0b)" : "rgba(255,255,255,0.05)"),
            color: isRunning ? "#f59e0b" : (customInput.trim() ? "#fff" : "#475569"),
            fontWeight: 800, fontSize: 11,
            cursor: (isRunning || !customInput.trim()) ? "not-allowed" : "pointer",
            boxShadow: (!isRunning && customInput.trim()) ? "0 4px 14px rgba(245,158,11,0.25)" : "none",
          }}
        >
          {isRunning ? "⟳ Simulating…" : "▶ Run Simulation"}
        </button>
        <div style={{ fontSize: 8.5, color: "#334155", marginTop: 4 }}>Ctrl+Enter to run</div>
      </div>

      {/* Agent activity */}
      <AnimatePresence>
        {simState.agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: "rgba(245,158,11,0.05)",
              border: "1px solid rgba(245,158,11,0.15)",
              borderRadius: 9, padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>
              Agent Activity
            </div>
            {simState.agents.map(agentId => {
              const def = AGENT_DEFS[agentId];
              return (
                <motion.div
                  key={agentId}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}
                >
                  <span style={{ fontSize: 13 }}>{def?.emoji ?? "🤖"}</span>
                  <span style={{ fontSize: 9.5, color: "#94a3b8" }}>
                    {def?.name ?? agentId} — analyzing…
                  </span>
                  {isRunning && (
                    <motion.span
                      style={{ color: "#f59e0b", fontSize: 9 }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >●</motion.span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Before / After comparison */}
      <AnimatePresence>
        {hasBefore && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {/* Before state */}
            <div style={{
              padding: "10px 12px", borderRadius: 9,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 7 }}>
                Before
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#e2e8f0" }}>{simState.before!.avgScore}</span>
                <div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>avg impact score</div>
                  <RiskBadge level={simState.before!.riskLevel} />
                </div>
                <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#475569" }}>
                  {simState.before!.nodeCount} nodes
                </span>
              </div>
            </div>

            {/* Scenario label */}
            {simState.scenario && (
              <div style={{
                padding: "8px 12px", borderRadius: 8,
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.14)",
                fontSize: 9.5, color: "#94a3b8", lineHeight: 1.5, fontStyle: "italic",
              }}>
                <strong style={{ color: "#f59e0b", fontStyle: "normal" }}>Scenario: </strong>
                {simState.scenario}
              </div>
            )}

            {/* Streaming analysis */}
            {simState.analysis && (
              <div style={{
                padding: "9px 11px", borderRadius: 8,
                background: "rgba(0,0,0,0.2)", borderLeft: "2px solid rgba(245,158,11,0.3)",
                fontSize: 9.5, color: "#94a3b8", lineHeight: 1.7,
                maxHeight: 130, overflowY: "auto" as const,
              }}>
                {simState.analysis}
                {isRunning && (
                  <motion.span
                    style={{ color: "#f59e0b", marginLeft: 2 }}
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >▌</motion.span>
                )}
              </div>
            )}

            {/* After state */}
            <AnimatePresence>
              {simState.after && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: "10px 12px", borderRadius: 9,
                    background: simState.after.scoreChange < 0 ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)",
                    border: `1px solid ${simState.after.scoreChange < 0 ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
                    color: simState.after.scoreChange < 0 ? "#ef4444" : "#22c55e", marginBottom: 7 }}>
                    After simulation
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: simState.after.scoreChange < 0 ? "#ef4444" : "#22c55e" }}>
                      {simState.after.avgScore}
                    </span>
                    <div>
                      <div style={{ fontSize: 9, color: "#64748b" }}>avg impact score</div>
                      <RiskBadge level={simState.after.riskLevel} />
                    </div>
                    <span style={{
                      marginLeft: "auto", fontWeight: 800, fontSize: 12,
                      color: simState.after.scoreChange < 0 ? "#ef4444" : "#22c55e",
                    }}>
                      {simState.after.scoreChange > 0 ? "+" : ""}{simState.after.scoreChange}
                    </span>
                  </div>

                  {/* Node delta bars */}
                  {simState.deltas.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                        Impact on Nodes
                      </div>
                      {simState.deltas.slice(0, 4).map((d, i) => (
                        <ScoreDeltaBar key={i} delta={d} />
                      ))}
                    </div>
                  )}

                  {/* Recommendation */}
                  {simState.after.recommendation && (
                    <div style={{
                      padding: "7px 9px", borderRadius: 7,
                      background: "rgba(0,0,0,0.2)",
                      fontSize: 9.5, color: "#94a3b8", lineHeight: 1.65,
                    }}>
                      <strong style={{ color: "#e2e8f0" }}>Recommendation: </strong>
                      {simState.after.recommendation}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            {isDone && simState.after && (
              <div style={{ display: "flex", gap: 7 }}>
                <button
                  onClick={onSaveSimulation}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)", color: "#94a3b8",
                    fontSize: 10, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  💾 Save
                </button>
                {simHistory.length > 0 && (
                  <button
                    onClick={() => { if (simHistory.length > 0) onApplyToCanvas(simHistory[simHistory.length - 1]); }}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 7,
                      border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)",
                      color: "#f59e0b", fontSize: 10, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    ↩ Apply Scores
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved history */}
      <AnimatePresence>
        {simHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 7 }}>
              Saved Simulations ({simHistory.length})
            </div>
            {simHistory.slice().reverse().map(h => (
              <div
                key={h.id}
                style={{
                  padding: "8px 10px", borderRadius: 8, marginBottom: 5,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 9.5, color: "#94a3b8", marginBottom: 3, lineHeight: 1.4 }}>
                  {h.scenario.length > 60 ? h.scenario.slice(0, 60) + "…" : h.scenario}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "#475569" }}>
                    {new Date(h.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: h.after.scoreChange < 0 ? "#ef4444" : "#22c55e" }}>
                    {h.before.avgScore}→{h.after.avgScore} ({h.after.scoreChange > 0 ? "+" : ""}{h.after.scoreChange})
                  </span>
                  <RiskBadge level={h.after.riskLevel} />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
