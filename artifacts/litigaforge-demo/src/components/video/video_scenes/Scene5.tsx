import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  'Dashboard', 'Match & Connect', 'Forge Workspace',
  'Legal Q&A', 'Judgment Finder', 'Document Analyzer',
  'Templates', 'Legal Aid',
];

const STARS = Array.from({ length: 12 }, (_, i) => ({
  top: 8 + (i * 73 % 84),
  left: 20 + (i * 61 % 78),
  dur: 3 + (i % 4),
}));

const IK_PILLS = [
  { year: '2009', court: 'Supreme Court' },
  { year: '2017', court: 'Supreme Court' },
  { year: '2022', court: 'Telangana HC' },
];

const AGENTS = [
  {
    name: 'Research Agent',
    role: '🔍  Live IndianKanoon Lookup',
    color: '#a855f7',
    lines: [
      'IK API → 5 live judgments fetched ✓',
      'Sarla Verma v. DTC (SC 2009):',
      '  Multiplier method — BINDING ✓',
      'National Insurance v. Pranay Sethi:',
      '  +40% future prospects — APPLY ✓',
      'Rajesh v. Rajbir Singh (2013):',
      '  Structured formula confirmed ✓',
    ],
  },
  {
    name: 'Strategy Agent',
    role: '⚡  Legal Strategy',
    color: '#0d9488',
    lines: [
      'Case: MACT Claim · Hyderabad DC',
      'Track 1 → Claim u/s 166 MV Act',
      'Track 2 → FIR u/s 279/304A IPC',
      'Track 3 → Insurance 3rd-party',
      'Interim solatium u/s 164A → yes',
      'Limitation: 3 yrs from accident',
      'Win probability: 91% ✓',
    ],
  },
  {
    name: 'Drafting Agent',
    role: '📄  6-Section Lawyer Package',
    color: '#f59e0b',
    lines: [
      'Generating Lawyer Package…',
      '1. Executive Summary — done ✓',
      '2. Client Advisory — done ✓',
      '3. Document Checklist — done ✓',
      '4. Action Plan — done ✓',
      '5. Draft Petition — done ✓',
      '6. Fee Recommendation — done ✓',
    ],
  },
];

const FOLDER_DOCS = [
  { icon: '📋', label: 'Lawyer Package',  color: '#0d9488' },
  { icon: '📊', label: 'Analysis Report', color: '#a855f7' },
  { icon: '⚖️', label: 'Vakalatnama',    color: '#f59e0b' },
  { icon: '🧾', label: 'Fee Invoice',     color: '#60a5fa' },
];

export function Scene5() {
  const [phase, setPhase] = useState(0);
  const [ikPhase, setIkPhase] = useState(0);
  const [synthPct, setSynthPct] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1600),
      setTimeout(() => setIkPhase(1), 2400),
      setTimeout(() => setIkPhase(2), 3900),
      setTimeout(() => setPhase(3), 4300),
      setTimeout(() => setPhase(4), 5300),
      setTimeout(() => setPhase(5), 10800),
      setTimeout(() => setPhase(6), 13500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase < 5) return;
    const start = performance.now();
    const dur = 2400;
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / dur);
      setSynthPct(p);
      if (p >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <motion.div
      className="absolute inset-0 flex bg-[#0a1628] z-20 text-white overflow-hidden"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right,#fff2 1px,transparent 1px),linear-gradient(to bottom,#fff2 1px,transparent 1px)`,
          backgroundSize: '4vw 4vw',
        }}
      />
      {STARS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ top: `${s.top}%`, left: `${s.left}%` }}
          animate={{ opacity: [0.1, 0.6, 0.1], scale: [1, 1.5, 1] }}
          transition={{ duration: s.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Nav Rail */}
      <motion.div
        className="w-[18vw] min-w-[110px] h-full bg-[#1a2744] border-r border-white/10 flex flex-col px-5 py-10 z-30 shrink-0"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-12 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#0d9488] flex items-center justify-center shrink-0">
            <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
          </div>
          <span className="text-[1.1vw] font-display font-bold truncate">LitigaForge</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item, i) => (
            <motion.div
              key={item}
              className={`px-3 py-2.5 rounded-xl text-[0.85vw] font-mono ${
                item === 'Forge Workspace'
                  ? 'bg-[#0d9488] text-white font-bold'
                  : 'text-white/50'
              }`}
              initial={{ opacity: 0, x: -16 }}
              animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
            >
              {item}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-8 gap-4 overflow-hidden z-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="shrink-0"
        >
          <h1 className="text-[3vw] font-display font-bold text-[#0d9488] leading-none">
            Forge Workspace
          </h1>
          <p className="text-[0.82vw] font-mono text-white/35 tracking-widest mt-1">
            5-AGENT LEGAL AI  ·  CLAUDE · GEMINI · GPT-5  ·  LIVE INDIANKANOON
          </p>
        </motion.div>

        {/* Prompt Box */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              className="bg-white/5 border border-white/15 rounded-2xl p-4 backdrop-blur-sm shrink-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.3 }}
            >
              <p className="text-[0.68vw] font-mono text-white/30 mb-2 tracking-wider uppercase">
                Case  ›  Motor Accident · MACT Compensation · Hyderabad District Court
              </p>
              <div className="flex items-center gap-4">
                <p className="flex-1 text-[0.88vw] font-mono text-white/80 leading-relaxed">
                  "Hit-and-run accident, victim critical, family seeks max compensation. FIR filed.
                  Generate full research, strategy, and court-ready petition."
                </p>
                <motion.div
                  className="shrink-0 px-5 py-2.5 bg-[#0d9488] text-white text-[0.85vw] font-display font-bold rounded-xl cursor-pointer select-none"
                  animate={
                    phase === 2
                      ? { boxShadow: ['0 0 0px #0d948800', '0 0 28px #0d948880', '0 0 0px #0d948800'] }
                      : phase === 3
                      ? { scale: [1, 0.93, 0.96], opacity: [1, 0.8, 1] }
                      : {}
                  }
                  transition={{ duration: 1.1, repeat: phase === 2 ? Infinity : 0 }}
                >
                  {phase >= 3 ? 'Forging…' : 'Forge →'}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* IK Pre-fetch Banner */}
        <AnimatePresence>
          {ikPhase >= 1 && (
            <motion.div
              className="shrink-0 rounded-xl border px-4 py-2 flex items-center gap-3"
              style={{
                background: 'rgba(168,85,247,0.08)',
                borderColor: ikPhase >= 2 ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.25)',
              }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-[#a855f7] shrink-0"
                animate={ikPhase === 1 ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                transition={{ duration: 0.7, repeat: ikPhase === 1 ? Infinity : 0 }}
              />
              <span className="text-[0.72vw] font-mono" style={{ color: '#d8b4fe' }}>
                {ikPhase >= 2
                  ? '✓  5 live judgments fetched from IndianKanoon API — injected into Research Agent'
                  : '⟳  Fetching live judgments from IndianKanoon API…'}
              </span>
              {ikPhase >= 2 && (
                <motion.div
                  className="ml-auto flex gap-1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {IK_PILLS.map((p, i) => (
                    <motion.span
                      key={i}
                      className="text-[0.62vw] font-mono px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.12 }}
                    >
                      {p.year} · {p.court}
                    </motion.span>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent Panels */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.name}
              className="flex-1 bg-[#0d1b30] border border-white/10 rounded-2xl p-4 flex flex-col overflow-hidden relative"
              initial={{ opacity: 0, y: 30 }}
              animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                initial={{ opacity: 0 }}
                animate={phase >= 3 ? { opacity: 0.12 } : {}}
                transition={{ duration: 1.5, delay: i * 0.15 }}
                style={{ background: `radial-gradient(circle at 50% 0%,${agent.color},transparent 70%)` }}
              />

              <div className="flex items-center gap-2.5 mb-3 relative z-10 shrink-0">
                <div
                  className="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: agent.color, boxShadow: `0 0 14px ${agent.color}50` }}
                >
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: agent.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.82vw] font-display font-bold truncate">{agent.name}</p>
                  <p className="text-[0.68vw] font-mono truncate" style={{ color: agent.color }}>
                    {agent.role}
                  </p>
                </div>
                {phase >= 4 && (
                  <motion.span
                    className="text-[0.6vw] font-mono px-2 py-0.5 rounded-full border shrink-0"
                    style={{ color: agent.color, borderColor: `${agent.color}60` }}
                    animate={phase >= 5 ? { opacity: 1 } : { opacity: [1, 0.4, 1] }}
                    transition={{ duration: 0.8, repeat: phase >= 5 ? 0 : Infinity }}
                  >
                    {phase >= 5 ? '✓ DONE' : 'WORKING'}
                  </motion.span>
                )}
              </div>

              <div className="flex-1 bg-black/40 rounded-xl p-3 font-mono text-[0.68vw] text-white/70 overflow-hidden relative z-10 border border-white/5 min-h-0">
                {phase >= 4 && <StreamingLines lines={agent.lines} delayS={i * 0.4} />}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Synthesis Row */}
        {phase >= 5 && (
          <motion.div
            className="bg-white/5 border border-[#0d9488]/40 rounded-xl p-3.5 shrink-0"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-between text-[0.75vw] font-mono mb-2">
              <span className="text-[#0d9488]">
                {phase >= 6
                  ? '✓  FORGE COMPLETE — 4 DOCUMENTS GENERATED · 📁 CASE FOLDER READY'
                  : '⟳  SYNTHESIZING 5 AGENTS + 5 LIVE IK JUDGMENTS…'}
              </span>
              <span className="text-white/50">
                {phase >= 6 ? '4 documents  ·  All PDFs ready' : `${Math.round((phase >= 6 ? 1 : synthPct) * 100)}%`}
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${(phase >= 6 ? 1 : synthPct) * 100}%`,
                  background: 'linear-gradient(90deg,#a855f7,#0d9488 50%,#f59e0b)',
                }}
                transition={{ duration: 0.05 }}
              />
            </div>
          </motion.div>
        )}

        {/* Case Folder Created */}
        {phase >= 6 && (
          <motion.div
            className="shrink-0"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0.35 }}
          >
            {/* Folder banner */}
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 mb-2"
              style={{ background: 'rgba(13,148,136,0.07)', border: '1px solid rgba(13,148,136,0.22)' }}
            >
              <span className="text-[1.2vw] shrink-0">📁</span>
              <div className="flex-1 min-w-0">
                <p className="text-[0.72vw] font-mono font-bold text-[#0d9488]">CASE FOLDER AUTO-CREATED</p>
                <p className="text-[0.6vw] font-mono text-white/35 truncate">
                  MACT_Motor_Accident_20260618 · 4 documents · Ready to download
                </p>
              </div>
              <motion.span
                className="text-[0.62vw] font-mono shrink-0 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(13,148,136,0.15)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.35)' }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ✓ All PDFs ready
              </motion.span>
            </div>
            {/* 4 doc pills */}
            <div className="flex gap-2">
              {FOLDER_DOCS.map((d, i) => (
                <motion.div
                  key={d.label}
                  className="flex-1 rounded-xl px-2 py-2.5 text-center"
                  style={{ background: `${d.color}12`, border: `1px solid ${d.color}35` }}
                  initial={{ opacity: 0, scale: 0.82, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.13, type: 'spring', bounce: 0.5 }}
                >
                  <div className="text-[1.1vw] mb-0.5">{d.icon}</div>
                  <p className="text-[0.6vw] font-mono font-bold leading-tight" style={{ color: d.color }}>
                    {d.label}
                  </p>
                  <p className="text-[0.55vw] font-mono text-[#0d9488] mt-0.5">↓ Download</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function StreamingLines({ lines, delayS = 0 }: { lines: string[]; delayS?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let intId: ReturnType<typeof setInterval>;
    const timeId = setTimeout(() => {
      intId = setInterval(() => {
        setCount((c) => {
          if (c >= lines.length) { clearInterval(intId); return c; }
          return c + 1;
        });
      }, 560);
    }, delayS * 1000);
    return () => { clearTimeout(timeId); clearInterval(intId); };
  }, [lines.length, delayS]);

  return (
    <div className="space-y-1 h-full overflow-hidden">
      {lines.slice(0, count).map((line, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className={
            line.startsWith('  ')
              ? 'text-white/40 pl-3'
              : line.includes('✓')
              ? 'text-green-400'
              : line.includes('⟳') || line.includes('→')
              ? 'text-blue-300'
              : 'text-white/70'
          }
        >
          {line}
        </motion.p>
      ))}
      {count < lines.length && (
        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.75, repeat: Infinity }}>
          ▊
        </motion.span>
      )}
    </div>
  );
}
