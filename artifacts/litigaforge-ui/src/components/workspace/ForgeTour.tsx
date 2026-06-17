import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "lf_forge_toured";

export function checkForgeToured(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

const STEPS = [
  {
    icon: "🗺️",
    title: "Spatial Canvas",
    desc: "Drag to pan, scroll to zoom. Right-click a node to edit or delete. Connect nodes by dragging from a handle to build argument chains.",
    color: "#3b82f6",
  },
  {
    icon: "🤖",
    title: "5-Agent Analysis",
    desc: "Click ⚡ Analyze to run 5 specialist AI agents — Litigator, Researcher, Risk Analyst, Drafter, and Strategist — in parallel. Thumb-up/down to teach your Twin.",
    color: "#14b8a6",
  },
  {
    icon: "🔍",
    title: "Indian Kanoon Search",
    desc: "Open the Search tab and search 50M+ Indian judgments. Matching cases drop directly onto your canvas as connected nodes.",
    color: "#a855f7",
  },
  {
    icon: "⚡",
    title: "What-If Simulation",
    desc: "Open the Simulation tab, pick a scenario (key witness unavailable, new evidence, etc.) and see how changing facts shifts your risk and strength scores before filing.",
    color: "#f59e0b",
  },
  {
    icon: "🧬",
    title: "Personal Legal Twin",
    desc: "The Twin tab learns from every session — which agents you trust, what nodes you add, which suggestions you accept — and personalises AI responses over time.",
    color: "#ec4899",
  },
];

interface ForgeTourProps {
  onDismiss: () => void;
}

export default function ForgeTour({ onDismiss }: ForgeTourProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      dismiss();
    } else {
      setStep(s => s + 1);
    }
  }

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    onDismiss();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.94 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        width: 288,
        borderRadius: 16,
        background: "rgba(8,18,40,0.97)",
        border: "1.5px solid rgba(20,184,166,0.25)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* Dynamic accent bar */}
      <motion.div
        key={step}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${current.color}, transparent)`,
          transformOrigin: "left",
        }}
      />

      <div style={{ padding: "16px 18px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: `${current.color}18`,
              border: `1px solid ${current.color}35`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              flexShrink: 0,
            }}>
              {current.icon}
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: current.color, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 2 }}>
                Quick Tour · {step + 1} of {STEPS.length}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                {current.title}
              </div>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close tour"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
              color: "#475569",
              fontSize: 18,
              lineHeight: 1,
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            style={{
              fontSize: 11.5,
              color: "#94a3b8",
              lineHeight: 1.65,
              marginBottom: 16,
              margin: "0 0 16px",
            }}
          >
            {current.desc}
          </motion.p>
        </AnimatePresence>

        {/* Step dots */}
        <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 14 }}>
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              style={{
                width: i === step ? 20 : 5,
                height: 5,
                borderRadius: 3,
                background: i === step ? current.color : i < step ? `${current.color}55` : "rgba(255,255,255,0.12)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={dismiss}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.04)",
              color: "#64748b",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            style={{
              flex: 2,
              padding: "8px 0",
              borderRadius: 8,
              border: `1px solid ${current.color}45`,
              background: `${current.color}18`,
              color: current.color,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isLast ? "✓ Got it!" : "Next →"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
