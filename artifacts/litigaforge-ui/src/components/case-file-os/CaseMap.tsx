import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

export interface CaseMapNode {
  id: string;
  /** Lucide icon (or any node) shown in the satellite tile. */
  icon?: ReactNode;
  /** Short label, e.g. "Matched lawyer", "Next hearing". */
  label: string;
  /** Headline metric, e.g. "92 fit", "28 Jun", "3 files". */
  metric: string;
  /** Secondary detail line. */
  sub?: string;
  /** Color token, e.g. "hsl(var(--cfos-gold))". Defaults to primary. */
  tone?: string;
  /** Optional explicit board coordinates; auto-laid-out around the centre if omitted. */
  x?: number;
  y?: number;
}

export interface CaseMapCenter {
  /** Small kicker above the title (defaults to "Active case"). */
  kicker?: string;
  /** Location chip, e.g. district. */
  location?: string;
  title: string;
  stageCurrent?: number;
  stageTotal?: number;
  /** 0–1 progress; derived from stageCurrent/stageTotal when omitted. */
  progress?: number;
}

export interface CaseMapLegendItem {
  tone: string;
  label: string;
}

export interface CaseMapProps {
  /** Satellite nodes around the case (lawyer, docs, hearing, AI, precedents, aid). */
  nodes: CaseMapNode[];
  /** The case at the centre of the dossier. */
  center: CaseMapCenter;
  title?: string;
  docket?: string;
  legend?: CaseMapLegendItem[];
  live?: boolean;
  /** Board height in px. */
  height?: number;
  className?: string;
  "data-testid"?: string;
}

const BW = 1120;
const C = { x: 560, y: 360 };
const RX = 360;
const RY = 250;

function curve(s: { x: number; y: number }, e: { x: number; y: number }) {
  const mx = (s.x + e.x) / 2, my = (s.y + e.y) / 2;
  const dx = e.x - s.x, dy = e.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = 42;
  const cx = mx + (-dy / len) * off, cy = my + (dx / len) * off;
  return `M ${s.x} ${s.y} Q ${cx} ${cy} ${e.x} ${e.y}`;
}

/**
 * CaseMap — a radial "living dossier" visualization. Renders an AI case
 * roadmap: a centre case node with satellite nodes (matched lawyer, documents,
 * hearings, AI strategy, precedents, legal aid) connected by animated leads.
 * Fully data-shaped — pass `nodes` and `center`; positions auto-lay-out on an
 * ellipse unless explicit x/y are supplied.
 */
export function CaseMap({
  nodes,
  center,
  title = "Case Map",
  docket,
  legend,
  live = true,
  height = 700,
  className,
  "data-testid": testId = "case-map",
}: CaseMapProps) {
  const n = Math.max(nodes.length, 1);
  const placed = nodes.map((node, i) => {
    if (node.x != null && node.y != null) return { ...node, x: node.x, y: node.y };
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    return { ...node, x: C.x + RX * Math.cos(angle), y: C.y + RY * Math.sin(angle) };
  });

  const progress =
    center.progress != null
      ? center.progress
      : center.stageCurrent != null && center.stageTotal
        ? center.stageCurrent / center.stageTotal
        : 0;

  return (
    <div className={`text-foreground ${className ?? ""}`} data-testid={testId}>
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="text-sm font-bold text-foreground leading-tight">{title}</div>
          {docket && <div className="cfos-docket mt-0.5">{docket}</div>}
        </div>
        {live && (
          <div className="flex items-center gap-2">
            <span className="cfos-live-dot" />
            <span className="cfos-docket">Real-time</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="relative rounded-2xl border border-border cfos-elev-2 overflow-hidden"
          style={{
            height,
            background: "hsl(var(--card))",
            backgroundImage: "radial-gradient(hsl(var(--cfos-grid) / .10) 1.1px, transparent 1.1px)",
            backgroundSize: "26px 26px",
          }}>
          <div className="relative mx-auto" style={{ width: BW, height }}>
            <svg viewBox={`0 0 ${BW} ${height}`} className="absolute inset-0 w-full h-full pointer-events-none">
              {placed.map((node, i) => {
                const tone = node.tone ?? "hsl(var(--primary))";
                const d = curve(C, { x: node.x, y: node.y });
                return (
                  <g key={node.id}>
                    <motion.path d={d} fill="none" stroke="hsl(var(--cfos-grid) / .35)" strokeWidth="1.75"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.05 + i * 0.04, ease: "easeOut" }} />
                    <motion.path d={d} fill="none" stroke={tone} strokeWidth="2.5"
                      strokeLinecap="round" strokeDasharray="5 215"
                      initial={{ strokeDashoffset: 220, opacity: 0 }}
                      animate={{ strokeDashoffset: [220, 0], opacity: [0, 0.9, 0.9] }}
                      transition={{ strokeDashoffset: { duration: 3, delay: 0.4 + i * 0.05, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.5, delay: 0.4 + i * 0.05 } }} />
                  </g>
                );
              })}
            </svg>

            {placed.map((node, i) => {
              const tone = node.tone ?? "hsl(var(--primary))";
              return (
                <motion.div key={node.id}
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.38, delay: 0.08 + i * 0.04, ease: [0.22, 0.61, 0.36, 1] }}
                  className="absolute w-48 rounded-xl border border-border bg-card cfos-elev-2 p-3"
                  style={{ left: node.x - 96, top: node.y - 44 }}
                  data-testid={`case-map-node-${node.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="grid place-items-center w-7 h-7 rounded-md"
                      style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}>
                      {node.icon}
                    </span>
                    <span className="cfos-docket">{node.label}</span>
                  </div>
                  <div className="mt-2 text-base font-bold text-foreground">{node.metric}</div>
                  {node.sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{node.sub}</div>}
                </motion.div>
              );
            })}

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.36, delay: 0.04, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute cfos-paper rounded-2xl border-2 p-4 w-64"
              style={{ left: C.x - 128, top: C.y - 78, borderColor: "hsl(var(--cfos-gold))" }}
              data-testid="case-map-center">
              <div className="flex items-center justify-between">
                <span className="cfos-docket" style={{ color: "hsl(var(--cfos-gold))" }}>{center.kicker ?? "Active case"}</span>
                {center.location && (
                  <span className="inline-flex items-center gap-1 cfos-docket"><MapPin className="w-3 h-3" /> {center.location}</span>
                )}
              </div>
              <h3 className="mt-2 text-base font-bold text-foreground leading-snug">{center.title}</h3>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--cfos-gold)))" }}
                    initial={{ width: 0 }} animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ duration: 0.9, delay: 0.4 }} />
                </div>
                {center.stageCurrent != null && center.stageTotal != null && (
                  <span className="cfos-mono text-xs font-semibold text-foreground">Stage {center.stageCurrent}/{center.stageTotal}</span>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {legend && legend.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            {legend.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-2 cfos-docket">
                <span className="w-3 h-3 rounded-full" style={{ background: item.tone }} /> {item.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
