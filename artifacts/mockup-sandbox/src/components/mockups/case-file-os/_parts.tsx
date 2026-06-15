import { useId } from "react";
import { motion } from "framer-motion";
import {
  Scale, ShieldCheck, FileText, Gavel, Search, MessageSquareText,
  ArrowUpRight, Command as CmdIcon, Phone, CalendarClock, MapPin, Sparkles,
} from "lucide-react";

/* ============================================================
   Instrument geometry helpers
   ============================================================ */
function pt(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  const large = (a1 - a0) % 360 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/* ============================================================
   Score Ring — 270° instrument dial with tick marks
   ============================================================ */
export function ScoreRing({
  score, label = "Match", size = 184, showLabel = true,
}: { score: number; label?: string; size?: number; showLabel?: boolean }) {
  const cx = 100, cy = 100, r = 76;
  const start = 225, sweep = 270;
  const gradId = `cfosScore-${useId()}`;
  const ticks = Array.from({ length: 11 }, (_, i) => start + (sweep / 10) * i);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--cfos-gold))" />
            <stop offset="100%" stopColor="hsl(var(--cfos-gold-soft))" />
          </linearGradient>
        </defs>
        {/* tick marks */}
        {ticks.map((a, i) => {
          const [x1, y1] = pt(cx, cy, 88, a);
          const [x2, y2] = pt(cx, cy, i % 5 === 0 ? 80 : 84, a);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(var(--muted-foreground) / .45)" strokeWidth={i % 5 === 0 ? 2 : 1} />
          );
        })}
        {/* track */}
        <path d={arc(cx, cy, r, start, start + sweep)} fill="none"
          stroke="hsl(var(--muted-foreground) / .18)" strokeWidth="9" strokeLinecap="round" />
        {/* value */}
        <motion.path d={arc(cx, cy, r, start, start + sweep)} fill="none"
          stroke={`url(#${gradId})`} strokeWidth="9" strokeLinecap="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: score / 100 }}
          viewport={{ once: true }} transition={{ duration: 1.3, ease: [0.22, 0.61, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="cfos-mono text-5xl font-bold leading-none text-foreground">{score}</div>
        {showLabel && <div className="cfos-docket mt-1.5" style={{ color: "hsl(var(--cfos-gold))" }}>{label} score</div>}
      </div>
    </div>
  );
}

/* ============================================================
   Risk Meter — 180° gauge with zones + needle
   ============================================================ */
export function RiskMeter({ value = 28, size = 184, showLabel = true }: { value?: number; size?: number; showLabel?: boolean }) {
  const cx = 100, cy = 100, r = 74;
  const a0 = 270, span = 180;
  const needle = a0 + (span * value) / 100;
  const [nx, ny] = pt(cx, cy, r - 8, needle);
  const [sx, sy] = pt(cx, cy, r - 8, a0);
  const zones: [number, number, string][] = [
    [0, 33, "hsl(var(--cfos-good))"],
    [33, 66, "hsl(var(--cfos-warn))"],
    [66, 100, "hsl(var(--cfos-risk))"],
  ];
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 116" className="w-full">
        {zones.map(([s, e, c], i) => (
          <path key={i} d={arc(cx, cy, r, a0 + (span * s) / 100, a0 + (span * e) / 100)}
            fill="none" stroke={c} strokeWidth="10" strokeLinecap="butt" opacity={0.85} />
        ))}
        {Array.from({ length: 9 }, (_, i) => {
          const a = a0 + (span / 8) * i;
          const [x1, y1] = pt(cx, cy, 84, a);
          const [x2, y2] = pt(cx, cy, 90, a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--muted-foreground) / .5)" strokeWidth="1.5" />;
        })}
        <motion.line x1={cx} y1={cy} stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round"
          initial={{ x2: sx, y2: sy }} whileInView={{ x2: nx, y2: ny }} viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }} />
        <circle cx={cx} cy={cy} r="6" fill="hsl(var(--foreground))" />
        <circle cx={cx} cy={cy} r="2.5" fill="hsl(var(--card))" />
      </svg>
      <div className="-mt-2 flex flex-col items-center">
        <div className="cfos-mono text-2xl font-bold text-foreground leading-none">{value}<span className="text-sm text-muted-foreground">/100</span></div>
        {showLabel && <div className="cfos-docket mt-1.5">Risk index</div>}
      </div>
    </div>
  );
}

/* ============================================================
   Confidence bars — multi-AI synthesis read-out
   ============================================================ */
export function ConfidenceBars() {
  const rows = [
    { k: "Claude Sonnet", v: 94 },
    { k: "Gemini 2.5", v: 88 },
    { k: "GPT-5", v: 91 },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.k} className="flex items-center gap-3">
          <div className="cfos-docket w-28 shrink-0 text-right">{r.k}</div>
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--cfos-gold)))" }}
              initial={{ width: 0 }} whileInView={{ width: `${r.v}%` }} viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.1 * i, ease: "easeOut" }} />
          </div>
          <div className="cfos-mono w-9 text-sm font-semibold text-foreground">{r.v}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Stage timeline — case progression docket
   ============================================================ */
export function StageTimeline({ active = 2 }: { active?: number }) {
  const stages = ["Filed", "Notice", "Hearing", "Arguments", "Judgment"];
  return (
    <div className="flex items-center">
      {stages.map((s, i) => {
        const done = i < active, now = i === active;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`grid place-items-center rounded-full border-2 transition-colors ${
                done ? "border-[hsl(var(--cfos-good))] bg-[hsl(var(--cfos-good))] text-white" :
                now ? "border-[hsl(var(--cfos-gold))] bg-[hsl(var(--cfos-gold))] text-[hsl(var(--accent-foreground))]" :
                "border-border bg-card text-muted-foreground"}`} style={{ width: 26, height: 26 }}>
                <span className="cfos-mono text-[11px] font-bold">{i + 1}</span>
              </div>
              <span className={`cfos-docket whitespace-nowrap ${now ? "text-foreground" : ""}`}>{s}</span>
            </div>
            {i < stages.length - 1 && (
              <div className="h-0.5 flex-1 mx-1 mb-5 rounded-full" style={{
                background: done ? "hsl(var(--cfos-good))" : "hsl(var(--border))" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Docket strip — monospace metadata header
   ============================================================ */
export function DocketStrip({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <span className="cfos-docket">{k}</span>
          <span className="cfos-mono text-sm font-semibold text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Hero device — the Case File card
   ============================================================ */
export function CaseFileCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
      className="cfos-paper rounded-2xl border border-border overflow-hidden">
      {/* file tab */}
      <div className="flex items-stretch">
        <div className="cfos-tab px-5 py-2 text-white"
          style={{ background: "hsl(var(--primary))" }}>
          <span className="cfos-docket text-white/90">Case file</span>
        </div>
        <div className="flex-1 flex items-center justify-end gap-2 pr-4">
          <span className="cfos-live-dot" />
          <span className="cfos-docket">Live · synced</span>
        </div>
      </div>

      <div className="cfos-rule p-6 pt-5">
        <DocketStrip items={[
          ["Case no", "TS/HC/2026/4471"],
          ["Filed", "12 JUN 2026"],
          ["Court", "Telangana HC"],
          ["Type", "Property"],
        ]} />

        <div className="mt-5 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground tracking-tight">
              Partition suit — ancestral property, Ranga Reddy
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              AI matched <span className="font-semibold text-foreground">Adv. M. Reddy</span> on
              practice area, jurisdiction, language (Telugu) and 14-yr track record.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Stamp />
              <Chip icon={<MapPin className="w-3 h-3" />}>Hyderabad</Chip>
              <Chip icon={<Phone className="w-3 h-3" />}>Direct line</Chip>
              <Chip icon={<CalendarClock className="w-3 h-3" />}>Next: 28 Jun</Chip>
            </div>
          </div>
          <div className="shrink-0 grid place-items-center">
            <ScoreRing score={92} label="Match" />
          </div>
        </div>

        <div className="cfos-hairline my-6" />
        <StageTimeline active={2} />
      </div>
    </motion.div>
  );
}

export function Stamp() {
  return (
    <span className="cfos-stamp inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold">
      <ShieldCheck className="w-3 h-3" /> Bar-verified
    </span>
  );
}

export function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-secondary-foreground">
      {icon}{children}
    </span>
  );
}

/* ============================================================
   Section heading with docket index
   ============================================================ */
export function SectionHead({ index, kicker, title, sub }: {
  index: string; kicker: string; title: string; sub?: string;
}) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-3">
        <span className="cfos-mono text-xs font-bold px-2 py-0.5 rounded"
          style={{ background: "hsl(var(--cfos-gold) / .16)", color: "hsl(var(--cfos-gold))" }}>{index}</span>
        <span className="cfos-docket">{kicker}</span>
        <div className="cfos-hairline flex-1" />
      </div>
      <h2 className="mt-3 text-2xl md:text-[1.7rem] font-bold tracking-tight text-foreground">{title}</h2>
      {sub && <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{sub}</p>}
    </div>
  );
}

/* ============================================================
   Buttons / inputs preview
   ============================================================ */
export function GoldButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="group inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold cfos-elev-1 transition-transform active:translate-y-px"
      style={{ background: "hsl(var(--cfos-gold))", color: "hsl(var(--accent-foreground))" }}>
      {children}<ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </button>
  );
}
export function InkButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground cfos-elev-1"
      style={{ background: "hsl(var(--primary))" }}>{children}</button>
  );
}
export function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/60 transition-colors">{children}</button>
  );
}

/* ============================================================
   THE LOOKBOOK — full design language, theme-agnostic body
   ============================================================ */
export function Lookbook() {
  const palette: [string, string][] = [
    ["Ink navy", "hsl(var(--primary))"],
    ["Gold", "hsl(var(--cfos-gold))"],
    ["Gold soft", "hsl(var(--cfos-gold-soft))"],
    ["Good", "hsl(var(--cfos-good))"],
    ["Warn", "hsl(var(--cfos-warn))"],
    ["Risk", "hsl(var(--cfos-risk))"],
    ["Paper", "hsl(var(--card))"],
    ["Border", "hsl(var(--border))"],
  ];
  const type: [string, string, string][] = [
    ["Display", "text-4xl font-bold tracking-tight", "The living dossier"],
    ["Heading", "text-2xl font-bold tracking-tight", "Matched in minutes"],
    ["Title", "text-lg font-semibold", "Partition suit — Ranga Reddy"],
    ["Body", "text-base text-muted-foreground", "AI synthesises three legal models into one strategy."],
    ["Docket", "cfos-docket", "CASE NO · TS/HC/2026/4471"],
  ];
  const langs: [string, string][] = [
    ["English", "Your case, in expert hands"],
    ["हिन्दी", "आपका मुकदमा, विशेषज्ञों के हाथों में"],
    ["తెలుగు", "మీ కేసు, నిపుణుల చేతుల్లో"],
    ["العربية", "قضيتك في أيدٍ خبيرة"],
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 md:px-10 py-12">
      {/* Masthead */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center rounded-lg w-9 h-9 cfos-elev-1"
            style={{ background: "hsl(var(--primary))" }}>
            <Scale className="w-5 h-5" style={{ color: "hsl(var(--cfos-gold))" }} />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground leading-tight">LitigaForge AI</div>
            <div className="cfos-docket">Case File OS · v1.0</div>
          </div>
        </div>
        <div className="cfos-docket hidden sm:block">Telangana · Andhra Pradesh</div>
      </div>

      {/* Hero copy */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }} className="cfos-rule mt-10">
        <span className="cfos-docket" style={{ color: "hsl(var(--cfos-gold))" }}>Design language</span>
        <h1 className="mt-3 text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.04]">
          The living dossier.
        </h1>
        <p className="mt-4 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
          A trust-first system for legal work — instrument-grade scoring, docket-precise
          metadata, and paper-depth surfaces that make every case feel like an open file.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <GoldButton>Post a case</GoldButton>
          <GhostButton><Search className="w-4 h-4" /> Find a lawyer</GhostButton>
        </div>
      </motion.div>

      {/* 01 — Hero device */}
      <section className="mt-16">
        <SectionHead index="01" kicker="Signature device" title="The case file"
          sub="Every match, document and hearing lives inside one tactile file — margin rule, docket header, and an instrument that scores fit at a glance." />
        <CaseFileCard />
      </section>

      {/* 02 — Instruments */}
      <section className="mt-16">
        <SectionHead index="02" kicker="Instruments" title="Read the case like a dial"
          sub="Precision gauges replace flat percentages — tick marks, sweeping arcs and a needle give weight to the numbers." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <InstrumentCard title="Match score"><ScoreRing score={92} showLabel={false} /></InstrumentCard>
          <InstrumentCard title="Risk index"><RiskMeter value={28} showLabel={false} /></InstrumentCard>
          <InstrumentCard title="Model synthesis"><div className="w-full pt-4"><ConfidenceBars /></div></InstrumentCard>
        </div>
      </section>

      {/* 03 — Surfaces */}
      <section className="mt-16">
        <SectionHead index="03" kicker="Material" title="Paper-depth surfaces"
          sub="Three elevation levels and a faint ruled texture give the interface the feel of stacked legal paper." />
        <div className="grid sm:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`cfos-elev-${n} rounded-xl border border-border bg-card p-5`}>
              <div className="cfos-docket">Elevation 0{n}</div>
              <div className="mt-3 h-20 rounded-lg cfos-paper border border-border" />
              <p className="mt-3 text-xs text-muted-foreground">
                {n === 1 ? "Resting surface — lists, rows." : n === 2 ? "Raised — cards, panels." : "Floating — palette, dialogs."}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 04 — Type + multilingual */}
      <section className="mt-16">
        <SectionHead index="04" kicker="Typography" title="Space Grotesk + JetBrains Mono"
          sub="A confident grotesque for voice, monospace for docket metadata — tuned for English, Hindi, Telugu and Arabic." />
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-border bg-card p-6 cfos-elev-1 space-y-4">
            {type.map(([label, cls, sample]) => (
              <div key={label} className="flex items-baseline gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <span className="cfos-docket w-16 shrink-0">{label}</span>
                <span className={`${cls} text-foreground`}>{sample}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-6 cfos-elev-1">
            <div className="cfos-docket mb-4">Multilingual specimen</div>
            <div className="space-y-3">
              {langs.map(([lang, line]) => (
                <div key={lang} dir={lang === "العربية" ? "rtl" : "ltr"}
                  className="flex items-center justify-between gap-4 rounded-lg bg-secondary/50 px-4 py-3">
                  <span className="cfos-docket shrink-0">{lang}</span>
                  <span className="text-base font-medium text-foreground text-right">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 05 — Controls */}
      <section className="mt-16">
        <SectionHead index="05" kicker="Controls" title="Components in the system"
          sub="Buttons, chips, stamps and the command bar — restrained, tactile, gold used as punctuation not paint." />
        <div className="rounded-xl border border-border bg-card p-6 cfos-elev-1">
          <div className="flex flex-wrap items-center gap-3">
            <GoldButton>Primary action</GoldButton>
            <InkButton><Gavel className="w-4 h-4" /> Open file</InkButton>
            <GhostButton><MessageSquareText className="w-4 h-4" /> Ask AI</GhostButton>
          </div>
          <div className="cfos-hairline my-5" />
          <div className="flex flex-wrap items-center gap-2.5">
            <Stamp />
            <Chip icon={<FileText className="w-3 h-3" />}>Document</Chip>
            <Chip icon={<MapPin className="w-3 h-3" />}>Hyderabad</Chip>
            <Chip icon={<Sparkles className="w-3 h-3" />}>AI draft</Chip>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: "hsl(var(--cfos-good) / .15)", color: "hsl(var(--cfos-good))" }}>● Active</span>
          </div>
          <div className="cfos-hairline my-5" />
          <button className="w-full sm:w-auto inline-flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground hover:border-[hsl(var(--cfos-gold))] transition-colors">
            <Search className="w-4 h-4" />
            <span>Search cases, lawyers, judgments…</span>
            <kbd className="cfos-mono ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[11px]">
              <CmdIcon className="w-3 h-3" />K
            </kbd>
          </button>
        </div>
      </section>

      {/* 06 — Palette */}
      <section className="mt-16">
        <SectionHead index="06" kicker="Color" title="Navy ink, gold seal"
          sub="A restrained, trust-first palette. Gold signals action and verification; semantic hues read instantly on instruments." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {palette.map(([name, c]) => (
            <div key={name} className="rounded-xl border border-border bg-card p-3 cfos-elev-1">
              <div className="h-16 rounded-lg border border-border" style={{ background: c }} />
              <div className="mt-2.5 text-sm font-semibold text-foreground">{name}</div>
              <div className="cfos-docket mt-0.5">token</div>
            </div>
          ))}
        </div>
      </section>

      {/* footer docket */}
      <div className="mt-16 border-t border-border pt-5 flex items-center justify-between">
        <span className="cfos-docket">Case File OS · LitigaForge AI · 2026</span>
        <span className="cfos-docket" style={{ color: "hsl(var(--cfos-gold))" }}>End of file</span>
      </div>
    </div>
  );
}

export function InstrumentCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 cfos-elev-2 flex flex-col items-center">
      <div className="cfos-docket self-start mb-2">{title}</div>
      <div className="flex-1 grid place-items-center w-full">{children}</div>
    </div>
  );
}
