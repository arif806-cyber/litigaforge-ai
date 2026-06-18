import { motion, AnimatePresence } from "framer-motion";
import { RELATIONSHIP_TYPES } from "./EdgeTypes";
import type { RelType } from "./EdgeTypes";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConnectionHint {
  sourceId:    string;
  sourceLabel: string;
  relType:     RelType;
}

interface Props {
  hints:          ConnectionHint[];
  onAccept:       (hint: ConnectionHint) => void;
  onDismissHint:  (sourceId: string) => void;
  onDismissAll:   () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TEAL   = "#14b8a6";
const DARK   = "rgba(7,13,26,0.97)";
const BORDER = "rgba(20,184,166,0.2)";
const FGD    = "#94a3b8";
const FG     = "#e2e8f0";

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ConnectionHintsTray({
  hints, onAccept, onDismissHint, onDismissAll,
}: Props) {
  return (
    <AnimatePresence>
      {hints.length > 0 && (
        <motion.div
          key="hints-tray"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0,      opacity: 1 }}
          exit={{ y: "100%",    opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            zIndex: 50,
            background: DARK,
            border: `1px solid ${BORDER}`,
            borderTop: `2px solid ${TEAL}`,
            borderRadius: "12px 12px 0 0",
            boxShadow: "0 -12px 40px rgba(0,0,0,0.7)",
            padding: "11px 13px 14px",
          }}
        >
          {/* ── Header ── */}
          <div style={{
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", marginBottom: 9,
          }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: TEAL, letterSpacing: "0.04em" }}>
                ⚡ Connection Hints
              </div>
              <div style={{ fontSize: 8.5, color: FGD, marginTop: 2, lineHeight: 1.5 }}>
                This judgment may relate to existing canvas nodes. Accept a hint to draw the edge.
              </div>
            </div>
            <button
              onClick={onDismissAll}
              data-testid="forge-hints-dismiss-all"
              style={{
                background: "none", border: "none", color: FGD,
                fontSize: 15, cursor: "pointer", padding: "0 4px",
                flexShrink: 0, lineHeight: 1,
              }}
            >✕</button>
          </div>

          {/* ── Hint cards ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <AnimatePresence initial={false}>
              {hints.map((hint, i) => {
                const rel = RELATIONSHIP_TYPES[hint.relType];
                return (
                  <motion.div
                    key={hint.sourceId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden", marginBottom: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.05 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Relationship badge */}
                    <span style={{
                      fontSize: 8.5, fontWeight: 800, letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      background: `${rel.color}18`,
                      border: `1px solid ${rel.color}44`,
                      color: rel.color,
                      padding: "2px 8px", borderRadius: 8,
                      flexShrink: 0,
                    }}>
                      {rel.icon} {rel.label}
                    </span>

                    {/* Source label */}
                    <span style={{
                      flex: 1, minWidth: 50,
                      fontSize: 10, color: FG, fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {hint.sourceLabel}
                    </span>

                    {/* Accept / Skip */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <button
                        onClick={() => onAccept(hint)}
                        data-testid={`forge-hint-accept-${hint.sourceId}`}
                        style={{
                          padding: "4px 11px", borderRadius: 6, border: "none",
                          background: `linear-gradient(135deg, ${rel.color}bb, ${rel.color})`,
                          color: "#fff", fontSize: 9.5, fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >Accept</button>
                      <button
                        onClick={() => onDismissHint(hint.sourceId)}
                        data-testid={`forge-hint-skip-${hint.sourceId}`}
                        style={{
                          padding: "4px 9px", borderRadius: 6,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: FGD, fontSize: 9.5, fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >Skip</button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
