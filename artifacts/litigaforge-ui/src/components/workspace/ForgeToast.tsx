import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

export interface ForgeToastItem {
  id:       string;
  type:     ToastType;
  message:  string;
  detail?:  string;
  duration?: number;
}

// ─── Per-type config ───────────────────────────────────────────────────────────

const CFG: Record<ToastType, { icon: string; color: string; bg: string; border: string }> = {
  success: { icon: "✓", color: "#14b8a6", bg: "rgba(20,184,166,0.10)", border: "rgba(20,184,166,0.28)" },
  error:   { icon: "✕", color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.28)"  },
  info:    { icon: "ℹ", color: "#3b82f6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.28)" },
  warning: { icon: "⚠", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)" },
};

// ─── Single toast ─────────────────────────────────────────────────────────────

interface ToastProps {
  item:      ForgeToastItem;
  onDismiss: (id: string) => void;
}

function SingleToast({ item, onDismiss }: ToastProps) {
  const cfg      = CFG[item.type];
  const dur      = item.duration ?? (item.type === "error" ? 6000 : 4000);
  const [pct, setPct] = useState(100);
  const startRef = useRef(Date.now());
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / dur) * 100);
      setPct(remaining);
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    const timer = setTimeout(() => onDismiss(item.id), dur);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timer);
    };
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      style={{
        position: "relative",
        minWidth: 280, maxWidth: 360,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 12,
        overflow: "hidden",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Content row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px 14px" }}>
        {/* Icon */}
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: `${cfg.color}20`,
          border: `1.5px solid ${cfg.color}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: cfg.color, fontSize: 11, fontWeight: 900, flexShrink: 0,
        }}>
          {cfg.icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.3 }}>
            {item.message}
          </div>
          {item.detail && (
            <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
              {item.detail}
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={() => onDismiss(item.id)}
          style={{
            background: "none", border: "none", color: "#475569",
            cursor: "pointer", fontSize: 12, padding: 0, flexShrink: 0,
            lineHeight: 1, marginTop: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 3, background: "rgba(255,255,255,0.05)",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: cfg.color,
          transition: "width 0.08s linear",
          borderRadius: "0 2px 2px 0",
        }} />
      </div>
    </motion.div>
  );
}

// ─── Toast stack ──────────────────────────────────────────────────────────────

export interface ToastStackProps {
  toasts:    ForgeToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div style={{
      position: "fixed",
      bottom: 24, right: 24,
      zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
      alignItems: "flex-end",
      pointerEvents: "none",
    }}>
      <AnimatePresence mode="popLayout">
        {toasts.map(item => (
          <div key={item.id} style={{ pointerEvents: "auto" }}>
            <SingleToast item={item} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Helper hook (optional convenience) ───────────────────────────────────────

export function createToastManager() {
  let _set: React.Dispatch<React.SetStateAction<ForgeToastItem[]>> | null = null;

  function register(setter: React.Dispatch<React.SetStateAction<ForgeToastItem[]>>) {
    _set = setter;
  }

  function toast(item: Omit<ForgeToastItem, "id">) {
    if (!_set) return;
    const id  = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    _set(prev => [...prev.slice(-5), { ...item, id }]);
  }

  return { register, toast };
}
