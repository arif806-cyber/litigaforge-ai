import "./_group.css";
import { motion } from "framer-motion";
import {
  Scale, ShieldCheck, FileText, Gavel, CalendarClock,
  Sparkles, LifeBuoy, MapPin,
} from "lucide-react";

const BW = 1120, BH = 700;
const C = { x: 560, y: 360 };

type Node = {
  id: string; x: number; y: number; icon: React.ReactNode;
  label: string; metric: string; sub: string; tone: string;
};

const NODES: Node[] = [
  { id: "lawyer", x: 250, y: 128, icon: <ShieldCheck className="w-4 h-4" />, label: "Matched lawyer", metric: "92 fit", sub: "Adv. M. Reddy · Telugu", tone: "hsl(var(--cfos-gold))" },
  { id: "docs", x: 880, y: 134, icon: <FileText className="w-4 h-4" />, label: "Documents", metric: "3 files", sub: "Sale deed · FIR · notice", tone: "hsl(var(--primary))" },
  { id: "hearing", x: 930, y: 372, icon: <CalendarClock className="w-4 h-4" />, label: "Next hearing", metric: "28 Jun", sub: "Telangana HC · Court 4", tone: "hsl(var(--cfos-warn))" },
  { id: "ai", x: 812, y: 592, icon: <Sparkles className="w-4 h-4" />, label: "AI strategy", metric: "3 models", sub: "Claude · Gemini · GPT-5", tone: "hsl(var(--cfos-good))" },
  { id: "judgments", x: 320, y: 598, icon: <Gavel className="w-4 h-4" />, label: "Precedents", metric: "5 cited", sub: "IndianKanoon linked", tone: "hsl(var(--primary))" },
  { id: "aid", x: 190, y: 372, icon: <LifeBuoy className="w-4 h-4" />, label: "Legal aid", metric: "Eligible", sub: "NALSA / TSLSA", tone: "hsl(var(--cfos-good))" },
];

function curve(s: { x: number; y: number }, e: { x: number; y: number }) {
  const mx = (s.x + e.x) / 2, my = (s.y + e.y) / 2;
  const dx = e.x - s.x, dy = e.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = 42;
  const cx = mx + (-dy / len) * off, cy = my + (dx / len) * off;
  return `M ${s.x} ${s.y} Q ${cx} ${cy} ${e.x} ${e.y}`;
}

export function CaseMap() {
  return (
    <div className="cfos min-h-screen bg-background text-foreground p-6 md:p-8">
      {/* header */}
      <div className="mx-auto max-w-6xl flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center rounded-lg w-9 h-9 cfos-elev-1" style={{ background: "hsl(var(--primary))" }}>
            <Scale className="w-5 h-5" style={{ color: "hsl(var(--cfos-gold))" }} />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground leading-tight">Case Map</div>
            <div className="cfos-docket">Living dossier · TS/HC/2026/4471</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="cfos-live-dot" />
          <span className="cfos-docket">Real-time</span>
        </div>
      </div>

      {/* board */}
      <div className="mx-auto max-w-6xl mt-4">
        <div className="relative rounded-2xl border border-border cfos-elev-2 overflow-hidden"
          style={{
            height: BH,
            background: "hsl(var(--card))",
            backgroundImage: "radial-gradient(hsl(var(--cfos-grid) / .10) 1.1px, transparent 1.1px)",
            backgroundSize: "26px 26px",
          }}>
          <div className="relative mx-auto" style={{ width: BW, height: BH }}>
            {/* connectors */}
            <svg viewBox={`0 0 ${BW} ${BH}`} className="absolute inset-0 w-full h-full pointer-events-none">
              {NODES.map((n, i) => {
                const d = curve(C, { x: n.x, y: n.y });
                return (
                  <g key={n.id}>
                    <motion.path d={d} fill="none" stroke="hsl(var(--cfos-grid) / .35)" strokeWidth="1.75"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.05 + i * 0.04, ease: "easeOut" }} />
                    <motion.path d={d} fill="none" stroke={n.tone} strokeWidth="2.5"
                      strokeLinecap="round" strokeDasharray="5 215"
                      initial={{ strokeDashoffset: 220, opacity: 0 }}
                      animate={{ strokeDashoffset: [220, 0], opacity: [0, 0.9, 0.9] }}
                      transition={{ strokeDashoffset: { duration: 3, delay: 0.4 + i * 0.05, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.5, delay: 0.4 + i * 0.05 } }} />
                  </g>
                );
              })}
            </svg>

            {/* satellite nodes */}
            {NODES.map((n, i) => (
              <motion.div key={n.id}
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.38, delay: 0.08 + i * 0.04, ease: [0.22, 0.61, 0.36, 1] }}
                className="absolute w-48 rounded-xl border border-border bg-card cfos-elev-2 p-3"
                style={{ left: n.x - 96, top: n.y - 44 }}>
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center w-7 h-7 rounded-md" style={{ background: `color-mix(in srgb, ${n.tone} 18%, transparent)`, color: n.tone }}>
                    {n.icon}
                  </span>
                  <span className="cfos-docket">{n.label}</span>
                </div>
                <div className="mt-2 text-base font-bold text-foreground">{n.metric}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{n.sub}</div>
              </motion.div>
            ))}

            {/* center: the case */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.36, delay: 0.04, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute cfos-paper rounded-2xl border-2 p-4 w-64"
              style={{ left: C.x - 128, top: C.y - 78, borderColor: "hsl(var(--cfos-gold))" }}>
              <div className="flex items-center justify-between">
                <span className="cfos-docket" style={{ color: "hsl(var(--cfos-gold))" }}>Active case</span>
                <span className="inline-flex items-center gap-1 cfos-docket"><MapPin className="w-3 h-3" /> Ranga Reddy</span>
              </div>
              <h3 className="mt-2 text-base font-bold text-foreground leading-snug">Partition suit — ancestral property</h3>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--cfos-gold)))" }}
                    initial={{ width: 0 }} animate={{ width: "55%" }} transition={{ duration: 0.9, delay: 0.4 }} />
                </div>
                <span className="cfos-mono text-xs font-semibold text-foreground">Stage 3/5</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {[["hsl(var(--cfos-gold))", "Match & verify"], ["hsl(var(--primary))", "Records"], ["hsl(var(--cfos-warn))", "Schedule"], ["hsl(var(--cfos-good))", "AI & aid"]].map(([c, t]) => (
            <span key={t} className="inline-flex items-center gap-2 cfos-docket">
              <span className="w-3 h-3 rounded-full" style={{ background: c }} /> {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
