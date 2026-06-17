import { motion } from "framer-motion";
import type { WS } from "./WorkspaceLang";

// ─── Shared helpers ────────────────────────────────────────────────────────────

const TEAL   = "#14b8a6";
const FG     = "#e2e8f0";
const FGD    = "#64748b";

// ─── No-session welcome ────────────────────────────────────────────────────────

interface NoSessionProps {
  t:             WS;
  onCreate:      () => void;
  onCreateDemo?: () => void;
}

export function NoSessionWelcome({ t, onCreate, onCreateDemo }: NoSessionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 60%, rgba(20,184,166,0.04) 0%, transparent 65%)",
        zIndex: 5,
        padding: 40,
        pointerEvents: "auto",
      }}
    >
      {/* Animated brand mark */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "linear-gradient(135deg, rgba(20,184,166,0.15), rgba(14,116,144,0.08))",
          border: "1.5px solid rgba(20,184,166,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          marginBottom: 24,
          boxShadow: "0 0 40px rgba(20,184,166,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        ⚡
      </motion.div>

      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: FG,
          letterSpacing: "-0.02em",
          marginBottom: 8,
          lineHeight: 1.3,
        }}>
          {t.welcomeTitle}
        </div>
        <div style={{ fontSize: 12, color: FGD, marginBottom: 32, lineHeight: 1.6 }}>
          {t.welcomeSub}
        </div>

        {/* Primary CTAs */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" as const }}>
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: "0 8px 30px rgba(20,184,166,0.35)" }}
            whileTap={{ scale: 0.97 }}
            onClick={onCreate}
            style={{
              padding: "12px 28px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #0d9488, #14b8a6)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12.5,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(20,184,166,0.3)",
              letterSpacing: "0.01em",
            }}
          >
            {t.createFirst}
          </motion.button>

          {onCreateDemo && (
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: "0 8px 30px rgba(168,85,247,0.25)" }}
              whileTap={{ scale: 0.97 }}
              onClick={onCreateDemo}
              style={{
                padding: "12px 22px",
                borderRadius: 10,
                border: "1.5px solid rgba(168,85,247,0.35)",
                background: "rgba(168,85,247,0.08)",
                color: "#a855f7",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
                letterSpacing: "0.01em",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {t.demoBtn}
            </motion.button>
          )}
        </div>

        {/* Demo context hint */}
        {onCreateDemo && (
          <div style={{
            marginTop: 10,
            fontSize: 9.5,
            color: "rgba(100,116,139,0.55)",
            letterSpacing: "0.02em",
          }}>
            Pre-loaded canvas · SC & CAT judgments · 9-node argument map
          </div>
        )}

        {/* Feature pills */}
        <div style={{
          display: "flex",
          flexWrap: "wrap" as const,
          gap: 8,
          justifyContent: "center",
          marginTop: 28,
        }}>
          {[
            { icon: "🔍", text: "Indian Kanoon" },
            { icon: "🤖", text: "5 AI Agents" },
            { icon: "⚡", text: "What-If Simulation" },
            { icon: "🧬", text: "Legal Twin" },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 10.5,
              color: FGD,
              fontWeight: 600,
            }}>
              <span>{icon}</span>
              {text}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty canvas guide ────────────────────────────────────────────────────────

interface EmptyCanvasProps {
  t:          WS;
  onSearch:   () => void;
  onAnalyze:  () => void;
  onAddNode:  () => void;
  isAnalyzing: boolean;
}

const STEPS = (t: WS) => [
  { num: "1", icon: "✍️", label: t.step1, desc: t.step1d, color: "#3b82f6" },
  { num: "2", icon: "🤖", label: t.step2, desc: t.step2d, color: TEAL },
  { num: "3", icon: "🗺️", label: t.step3, desc: t.step3d, color: "#a855f7" },
];

export function EmptyCanvasGuide({ t, onSearch, onAnalyze, onAddNode, isAnalyzing }: EmptyCanvasProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 55%, rgba(20,184,166,0.03) 0%, transparent 70%)",
        zIndex: 5,
        padding: 32,
        pointerEvents: "none",
      }}
    >
      <div style={{ pointerEvents: "auto", textAlign: "center", maxWidth: 540 }}>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div style={{
            fontSize: 18,
            fontWeight: 800,
            color: FG,
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}>
            {t.emptyTitle}
          </div>
          <div style={{ fontSize: 11.5, color: FGD, marginBottom: 32 }}>
            {t.emptySub}
          </div>
        </motion.div>

        {/* Three-step flow */}
        <div style={{
          display: "flex",
          gap: 0,
          alignItems: "stretch",
          marginBottom: 28,
          background: "rgba(8,18,40,0.85)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          overflow: "hidden",
          backdropFilter: "blur(12px)",
        }}>
          {STEPS(t).map((step, i) => (
            <div key={i} style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "16px 14px",
              borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              position: "relative",
            }}>
              {/* Step number ring */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: `${step.color}18`,
                border: `1.5px solid ${step.color}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                marginBottom: 10,
              }}>
                {step.icon}
              </div>

              <div style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: step.color,
                marginBottom: 5,
                letterSpacing: "0.02em",
              }}>
                {step.label}
              </div>
              <div style={{
                fontSize: 9.5,
                color: FGD,
                lineHeight: 1.55,
                textAlign: "center",
              }}>
                {step.desc}
              </div>

              {/* Arrow connector */}
              {i < 2 && (
                <div style={{
                  position: "absolute",
                  right: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "rgba(255,255,255,0.15)",
                  fontSize: 14,
                  zIndex: 1,
                  pointerEvents: "none",
                }}>›</div>
              )}
            </div>
          ))}
        </div>

        {/* Quick action buttons */}
        <div style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap" as const,
        }}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onSearch}
            style={quickBtn(TEAL)}
          >
            🔍 Search Indian Kanoon
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onAnalyze}
            disabled={isAnalyzing}
            style={quickBtn("#f59e0b")}
          >
            ⚡ {isAnalyzing ? t.analyzing : t.runAnalysis.replace("⚡ ", "")}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onAddNode}
            style={quickBtn("#a855f7")}
          >
            + Add First Node
          </motion.button>
        </div>

        {/* Subtle tip */}
        <div style={{
          marginTop: 20,
          fontSize: 9.5,
          color: "rgba(100,116,139,0.6)",
          letterSpacing: "0.03em",
        }}>
          Drag nodes to reposition • Double-click to edit • Connect nodes to build arguments
        </div>
      </div>
    </motion.div>
  );
}

// ─── Shared button style ───────────────────────────────────────────────────────

function quickBtn(color: string): React.CSSProperties {
  return {
    padding: "9px 16px",
    borderRadius: 8,
    border: `1px solid ${color}35`,
    background: `${color}12`,
    color: color,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 6,
  };
}
