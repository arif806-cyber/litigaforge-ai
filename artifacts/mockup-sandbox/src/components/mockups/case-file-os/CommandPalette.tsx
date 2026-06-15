import "./_group.css";
import { motion } from "framer-motion";
import {
  Search, FileText, Gavel, Scale, MessageSquareText, ShieldCheck,
  CornerDownLeft, ArrowRight, Sparkles, Phone, FolderOpen,
} from "lucide-react";

type Row = { icon: React.ReactNode; label: string; meta: string; active?: boolean };

function Group({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="px-2 pt-3">
      <div className="cfos-docket px-3 pb-1.5">{title}</div>
      {rows.map((r) => (
        <div key={r.label}
          className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-default ${
            r.active ? "" : "hover:bg-secondary/60"}`}
          style={r.active ? { background: "hsl(var(--cfos-gold) / .14)" } : undefined}>
          {r.active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{ background: "hsl(var(--cfos-gold))" }} />}
          <span className={`grid place-items-center w-8 h-8 rounded-md border ${
            r.active ? "border-transparent" : "border-border bg-card"}`}
            style={r.active ? { background: "hsl(var(--cfos-gold) / .2)", color: "hsl(var(--cfos-gold))" } : { color: "hsl(var(--muted-foreground))" }}>
            {r.icon}
          </span>
          <span className="flex-1 text-sm font-medium text-foreground">{r.label}</span>
          <span className="cfos-docket">{r.meta}</span>
          {r.active
            ? <CornerDownLeft className="w-4 h-4" style={{ color: "hsl(var(--cfos-gold))" }} />
            : <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
      ))}
    </div>
  );
}

export function CommandPalette() {
  return (
    <div className="cfos dark min-h-screen grid place-items-center p-6 relative overflow-hidden"
      style={{ background: "radial-gradient(120% 90% at 50% -10%, hsl(220 50% 16%), hsl(222 42% 6%))" }}>
      {/* faint scanline texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, hsl(210 40% 80% / .6) 0 1px, transparent 1px 4px)" }} />

      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
        className="cfos-elev-3 relative w-full max-w-2xl rounded-2xl border border-border overflow-hidden"
        style={{ background: "hsl(var(--popover))" }}>

        {/* search bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1 flex items-center text-base text-foreground">
            partition suit hyderabad
            <motion.span className="inline-block w-[2px] h-5 ml-0.5"
              style={{ background: "hsl(var(--cfos-gold))" }}
              animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
            style={{ background: "hsl(var(--cfos-gold) / .16)", color: "hsl(var(--cfos-gold))" }}>
            <Sparkles className="w-3 h-3" /> AI
          </span>
        </div>

        <div className="max-h-[26rem] overflow-y-auto pb-2">
          <Group title="Jump to case" rows={[
            { icon: <FolderOpen className="w-4 h-4" />, label: "TS/HC/2026/4471 — Partition suit", meta: "Open file", active: true },
            { icon: <FileText className="w-4 h-4" />, label: "Sale deed — Ranga Reddy.pdf", meta: "Document" },
          ]} />
          <Group title="AI actions" rows={[
            { icon: <Sparkles className="w-4 h-4" />, label: "Draft a legal notice", meta: "⌘ D" },
            { icon: <MessageSquareText className="w-4 h-4" />, label: "Ask: limitation period for partition?", meta: "Enter" },
            { icon: <Scale className="w-4 h-4" />, label: "Synthesise strategy (3 models)", meta: "⌘ S" },
          ]} />
          <Group title="Discover" rows={[
            { icon: <ShieldCheck className="w-4 h-4" />, label: "Find verified lawyers — Telugu", meta: "⌘ L" },
            { icon: <Gavel className="w-4 h-4" />, label: "Search judgments & precedents", meta: "⌘ J" },
            { icon: <Phone className="w-4 h-4" />, label: "Free legal aid — NALSA / TSLSA", meta: "⌘ A" },
          ]} />
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5"
          style={{ background: "hsl(var(--secondary) / .4)" }}>
          <div className="flex items-center gap-3">
            <Hint k="↑↓" t="navigate" />
            <Hint k="↵" t="open" />
            <Hint k="esc" t="close" />
          </div>
          <div className="flex items-center gap-1.5 cfos-docket">
            <Scale className="w-3.5 h-3.5" style={{ color: "hsl(var(--cfos-gold))" }} /> Case File OS
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Hint({ k, t }: { k: string; t: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 cfos-docket">
      <kbd className="cfos-mono rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-foreground">{k}</kbd>
      {t}
    </span>
  );
}
