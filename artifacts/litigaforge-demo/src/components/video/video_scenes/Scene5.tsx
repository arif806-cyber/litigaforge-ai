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
    icon: '🔬',
    role: 'IK Judgments · Statutes · Precedents',
    color: '#a855f7',
    lines: [
      'IK API → 5 live judgments fetched ✓',
      'Sarla Verma v. DTC (SC 2009):',
      '  Multiplier method — BINDING ✓',
      'Motor Vehicles Act §163-A applies',
      'Precedent chain: confirmed ✓',
    ],
  },
  {
    name: 'Strategy Agent',
    icon: '💡',
    role: 'Legal Framework · Parallel Tracks',
    color: '#0d9488',
    lines: [
      'Case: MACT Claim · Hyderabad DC',
      'Track 1 → §166 Motor Vehicles Act',
      'Track 2 → FIR u/s 279/304A IPC',
      'Track 3 → Insurance 3rd-party',
      'Limitation: 3 yrs · Filing ready ✓',
    ],
  },
  {
    name: 'Risk Agent',
    icon: '⚠️',
    role: 'Opposition Analysis · 1–10 Score',
    color: '#f59e0b',
    lines: [
      'Stress-testing arguments…',
      'Limitation period: within range ✓',
      'Opposition angle: low-speed claim',
      'Risk Score: 4 / 10 — manageable',
      'Mitigation: secure dashcam footage',
    ],
  },
  {
    name: 'Drafting Agent',
    icon: '✍️',
    role: '6-Section Court-Ready Package',
    color: '#60a5fa',
    lines: [
      'Compiling all 4 agent outputs…',
      '1. Executive Summary — done ✓',
      '2. Document Checklist — done ✓',
      '3. Draft Petition — done ✓',
      'Lawyer Package complete · PDF ✓',
    ],
  },
  {
    name: 'Predictive Agent',
    icon: '🔮',
    role: 'Outcome Modelling · Judicial Trends',
    color: '#f97316',
    lines: [
      'Analysing Hyderabad HC patterns…',
      'MACT cases 2023–25: 89% grant',
      'Multiplier claim success: 91%',
      'Win probability: 78–91% range ✓',
      'Timeline estimate: 8–14 months',
    ],
  },
];

const RIGHT_TABS = [
  { icon: '📁', name: 'Case Files',    desc: 'Canvas sessions & saved history',    active: true  },
  { icon: '🔍', name: 'IK Search',     desc: 'Live IndianKanoon judgment lookup',   active: false },
  { icon: '💡', name: 'AI Insights',   desc: 'Proactive strategy suggestions',      active: false },
  { icon: '🎭', name: 'Simulate',      desc: 'What-if scenario & score delta',      active: false },
  { icon: '🧠', name: 'Personal Twin', desc: 'Learns your strategy preferences',    active: false },
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
        className="w-[17vw] min-w-[105px] h-full bg-[#1a2744] border-r border-white/10 flex flex-col px-4 py-8 z-30 shrink-0"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-8 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#0d9488] flex items-center justify-center shrink-0">
            <div className="w-2.5 h-2.5 bg-white rounded-sm rotate-45" />
          </div>
          <span className="text-[1vw] font-display font-bold truncate">LitigaForge</span>
        </div>
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item, i) => (
            <motion.div
              key={item}
              className={`px-2.5 py-2 rounded-lg text-[0.78vw] font-mono ${
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

        {/* Session in sidebar */}
        <motion.div
          className="mt-auto rounded-xl p-2.5"
          style={{ background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.18)' }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-[0.58vw] font-mono text-[#0d9488] font-bold">📁 Active Session</p>
          <p className="text-[0.55vw] font-mono text-white/30 mt-0.5 truncate">MACT_Motor_Accident…</p>
        </motion.div>
      </motion.div>

      {/* Content area: workspace + right panel */}
      <div className="flex-1 flex min-w-0 overflow-hidden">

        {/* Main workspace */}
        <div className="flex-1 flex flex-col px-5 py-5 gap-2.5 overflow-hidden z-20 min-w-0">

          {/* Header */}
          <motion.div
            className="shrink-0"
            initial={{ opacity: 0, y: -16 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[2.4vw] font-display font-bold text-[#0d9488] leading-none">
                  Forge Workspace
                </h1>
                <p className="text-[0.72vw] font-mono text-white/30 tracking-widest mt-0.5">
                  5-AGENT LEGAL AI · CLAUDE · GEMINI · GPT-5 · LIVE INDIANKANOON
                </p>
              </div>
              {/* Analyze button */}
              {phase >= 2 && phase < 4 && (
                <motion.div
                  className="px-4 py-2 bg-[#0d9488] text-white text-[0.82vw] font-display font-bold rounded-xl"
                  animate={phase === 2
                    ? { boxShadow: ['0 0 0px #0d948800', '0 0 24px #0d948880', '0 0 0px #0d948800'] }
                    : { scale: [1, 0.93, 0.96], opacity: [1, 0.8, 1] }
                  }
                  transition={{ duration: 1.1, repeat: phase === 2 ? Infinity : 0 }}
                >
                  {phase >= 3 ? '⚡ Forging…' : '⚡ Analyze →'}
                </motion.div>
              )}
              {phase >= 4 && (
                <div
                  className="px-4 py-2 text-[0.82vw] font-display font-bold rounded-xl"
                  style={{ background: 'rgba(13,148,136,0.12)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)' }}
                >
                  {phase >= 6 ? '✓ Analysis Complete' : '⚡ Analysing…'}
                </div>
              )}
            </div>

            {/* Human flow bar */}
            <motion.div
              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              initial={{ opacity: 0, y: 4 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.7 }}
            >
              <span className="text-[0.85vw]">👤</span>
              <span className="text-[0.62vw] font-mono text-white/45">Priya Sharma (Client)</span>
              <span className="text-white/20 text-[0.62vw] mx-0.5">→</span>
              <span className="text-[0.85vw]">🤝</span>
              <span className="text-[0.62vw] font-mono text-[#0d9488] font-bold">AI Match #482 · Score 94/100</span>
              <span className="text-white/20 text-[0.62vw] mx-0.5">→</span>
              <span className="text-[0.85vw]">⚖️</span>
              <span className="text-[0.62vw] font-mono text-white/45">Adv. Arjun Kumar</span>
              <span className="text-[0.62vw] font-mono text-white/20 ml-auto">Advocate opened Forge Workspace</span>
            </motion.div>
          </motion.div>

          {/* Prompt Box */}
          <AnimatePresence>
            {phase >= 2 && (
              <motion.div
                className="bg-white/5 border border-white/12 rounded-xl p-3 shrink-0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0.3 }}
              >
                <p className="text-[0.6vw] font-mono text-white/28 mb-1.5 tracking-wider uppercase">
                  Case › Motor Accident · MACT Compensation · Hyderabad District Court
                </p>
                <p className="text-[0.82vw] font-mono text-white/75 leading-relaxed">
                  "Hit-and-run accident, victim critical, family seeks max compensation. FIR filed.
                  Generate full research, strategy, and court-ready petition."
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* IK Pre-fetch Banner */}
          <AnimatePresence>
            {ikPhase >= 1 && (
              <motion.div
                className="shrink-0 rounded-xl border px-3 py-1.5 flex items-center gap-2.5"
                style={{
                  background: 'rgba(168,85,247,0.08)',
                  borderColor: ikPhase >= 2 ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.25)',
                }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-[#a855f7] shrink-0"
                  animate={ikPhase === 1 ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                  transition={{ duration: 0.7, repeat: ikPhase === 1 ? Infinity : 0 }}
                />
                <span className="text-[0.68vw] font-mono" style={{ color: '#d8b4fe' }}>
                  {ikPhase >= 2
                    ? '✓  5 live judgments fetched from IndianKanoon API — injected into Research Agent'
                    : '⟳  Fetching live judgments from IndianKanoon API…'}
                </span>
                {ikPhase >= 2 && (
                  <motion.div
                    className="ml-auto flex gap-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {IK_PILLS.map((p, i) => (
                      <motion.span
                        key={i}
                        className="text-[0.58vw] font-mono px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        {p.year} · {p.court}
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 5 Agent Grid (3 + 2) ─────────────────────────────── */}
          <AnimatePresence>
            {phase >= 3 && (
              <motion.div
                className="flex-1 flex flex-col gap-2 min-h-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {/* Row 1 — Research · Strategy · Risk */}
                <div className="flex gap-2 flex-1 min-h-0">
                  {AGENTS.slice(0, 3).map((agent, i) => (
                    <motion.div
                      key={agent.name}
                      className="flex-1 bg-[#0d1b30] border rounded-xl p-2.5 flex flex-col overflow-hidden relative"
                      style={{ borderColor: `${agent.color}28` }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: i * 0.1 }}
                    >
                      <div
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ background: `radial-gradient(circle at 50% 0%,${agent.color}14,transparent 65%)` }}
                      />
                      <div className="flex items-center gap-1.5 mb-1.5 relative z-10 shrink-0">
                        <span className="text-[0.85vw] shrink-0">{agent.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.65vw] font-mono font-bold truncate" style={{ color: agent.color }}>
                            {agent.name}
                          </p>
                          <p className="text-[0.54vw] font-mono text-white/32 truncate">{agent.role}</p>
                        </div>
                        {phase >= 4 && (
                          <motion.span
                            className="text-[0.5vw] font-mono px-1.5 py-0.5 rounded-full border shrink-0"
                            style={{ color: agent.color, borderColor: `${agent.color}50`, background: `${agent.color}0e` }}
                            animate={phase >= 5 ? { opacity: 1 } : { opacity: [1, 0.4, 1] }}
                            transition={{ duration: 0.8, repeat: phase >= 5 ? 0 : Infinity }}
                          >
                            {phase >= 5 ? '✓ DONE' : '⟳ RUNNING'}
                          </motion.span>
                        )}
                      </div>
                      <div className="flex-1 bg-black/45 rounded-lg p-2 font-mono text-[0.6vw] text-white/65 overflow-hidden relative z-10 border border-white/5 min-h-0">
                        {phase >= 4 && <StreamingLines lines={agent.lines} delayS={i * 0.32} />}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Row 2 — Drafting · Predictive (centered, same width as row-1 cells) */}
                <div className="flex gap-2 flex-1 min-h-0 justify-center">
                  {AGENTS.slice(3, 5).map((agent, i) => (
                    <motion.div
                      key={agent.name}
                      className="bg-[#0d1b30] border rounded-xl p-2.5 flex flex-col overflow-hidden relative"
                      style={{ borderColor: `${agent.color}28`, width: 'calc(33.33% - 4px)' }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: (i + 3) * 0.1 }}
                    >
                      <div
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ background: `radial-gradient(circle at 50% 0%,${agent.color}14,transparent 65%)` }}
                      />
                      <div className="flex items-center gap-1.5 mb-1.5 relative z-10 shrink-0">
                        <span className="text-[0.85vw] shrink-0">{agent.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.65vw] font-mono font-bold truncate" style={{ color: agent.color }}>
                            {agent.name}
                          </p>
                          <p className="text-[0.54vw] font-mono text-white/32 truncate">{agent.role}</p>
                        </div>
                        {phase >= 4 && (
                          <motion.span
                            className="text-[0.5vw] font-mono px-1.5 py-0.5 rounded-full border shrink-0"
                            style={{ color: agent.color, borderColor: `${agent.color}50`, background: `${agent.color}0e` }}
                            animate={phase >= 5 ? { opacity: 1 } : { opacity: [1, 0.4, 1] }}
                            transition={{ duration: 0.8, repeat: phase >= 5 ? 0 : Infinity }}
                          >
                            {phase >= 5 ? '✓ DONE' : '⟳ RUNNING'}
                          </motion.span>
                        )}
                      </div>
                      <div className="flex-1 bg-black/45 rounded-lg p-2 font-mono text-[0.6vw] text-white/65 overflow-hidden relative z-10 border border-white/5 min-h-0">
                        {phase >= 4 && <StreamingLines lines={agent.lines} delayS={(i + 3) * 0.32} />}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Synthesis Row */}
          {phase >= 5 && (
            <motion.div
              className="bg-white/5 border border-[#0d9488]/35 rounded-xl p-3 shrink-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-between text-[0.7vw] font-mono mb-1.5">
                <span className="text-[#0d9488]">
                  {phase >= 6
                    ? '✓  FORGE COMPLETE — 5 AGENTS · 5 LIVE IK JUDGMENTS · 4 DOCUMENTS GENERATED'
                    : '⟳  SYNTHESIZING 5 AGENTS + 5 LIVE IK JUDGMENTS…'}
                </span>
                <span className="text-white/45">
                  {phase >= 6 ? '4 docs · All PDFs ready' : `${Math.round((phase >= 6 ? 1 : synthPct) * 100)}%`}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${(phase >= 6 ? 1 : synthPct) * 100}%`,
                    background: 'linear-gradient(90deg,#a855f7,#0d9488 40%,#f59e0b 70%,#f97316)',
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
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-2 mb-2"
                style={{ background: 'rgba(13,148,136,0.07)', border: '1px solid rgba(13,148,136,0.22)' }}
              >
                <span className="text-[1.1vw] shrink-0">📁</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.68vw] font-mono font-bold text-[#0d9488]">CASE FOLDER AUTO-CREATED</p>
                  <p className="text-[0.57vw] font-mono text-white/32 truncate">
                    MACT_Motor_Accident_20260618 · 4 documents · Client &amp; Advocate can download
                  </p>
                </div>
                <motion.span
                  className="text-[0.58vw] font-mono shrink-0 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(13,148,136,0.15)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.35)' }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ✓ All PDFs ready
                </motion.span>
              </div>
              <div className="flex gap-2">
                {FOLDER_DOCS.map((d, i) => (
                  <motion.div
                    key={d.label}
                    className="flex-1 rounded-xl px-2 py-2 text-center"
                    style={{ background: `${d.color}12`, border: `1px solid ${d.color}35` }}
                    initial={{ opacity: 0, scale: 0.82, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: i * 0.12, type: 'spring', bounce: 0.5 }}
                  >
                    <div className="text-[1vw] mb-0.5">{d.icon}</div>
                    <p className="text-[0.56vw] font-mono font-bold leading-tight" style={{ color: d.color }}>
                      {d.label}
                    </p>
                    <p className="text-[0.52vw] font-mono text-[#0d9488] mt-0.5">↓ Download</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right Panel: Workspace Tabs ───────────────────────────────────── */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              className="w-[17vw] shrink-0 border-l border-white/10 flex flex-col py-5 px-3 gap-1.5"
              style={{ background: 'rgba(255,255,255,0.018)' }}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
            >
              <p className="text-[0.55vw] font-mono text-white/22 uppercase tracking-widest mb-1.5 px-1">
                Workspace Tools
              </p>

              {RIGHT_TABS.map((tab, i) => (
                <motion.div
                  key={tab.name}
                  className="flex items-start gap-2 px-2.5 py-2 rounded-xl cursor-pointer"
                  style={
                    tab.active
                      ? { background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.28)' }
                      : { border: '1px solid transparent' }
                  }
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.09, type: 'spring', stiffness: 200, damping: 22 }}
                >
                  <span className="text-[1.05vw] shrink-0 mt-0.5">{tab.icon}</span>
                  <div className="min-w-0">
                    <p
                      className="text-[0.65vw] font-mono font-bold leading-none"
                      style={{ color: tab.active ? '#0d9488' : 'rgba(255,255,255,0.62)' }}
                    >
                      {tab.name}
                    </p>
                    <p className="text-[0.54vw] font-mono text-white/26 mt-0.5 leading-tight">{tab.desc}</p>
                  </div>
                </motion.div>
              ))}

              {/* Divider */}
              <div className="my-1 h-px bg-white/8" />

              {/* Consult-agent micro demo */}
              <motion.div
                className="flex items-start gap-2 px-2.5 py-2 rounded-xl"
                style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <span className="text-[1vw] shrink-0">💬</span>
                <div className="min-w-0">
                  <p className="text-[0.62vw] font-mono font-bold text-[#c084fc]">Ask an Agent</p>
                  <p className="text-[0.52vw] font-mono text-white/25 leading-tight mt-0.5">
                    Direct Q&amp;A with any of the 5 agents
                  </p>
                </div>
              </motion.div>

              {/* Simulate call-out at phase 6 */}
              {phase >= 6 && (
                <motion.div
                  className="mt-auto px-2.5 py-2.5 rounded-xl"
                  style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.22)' }}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.4 }}
                >
                  <p className="text-[0.62vw] font-mono text-[#f97316] font-bold">🎭 Simulate</p>
                  <p className="text-[0.52vw] font-mono text-white/28 mt-0.5 leading-tight">
                    "What if FIR was delayed 6 months?" → score shifts live
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
        setCount(c => {
          if (c >= lines.length) {
            clearInterval(intId);
            return c;
          }
          return c + 1;
        });
      }, 1050);
    }, delayS * 1000);
    return () => { clearTimeout(timeId); clearInterval(intId); };
  }, [lines.length, delayS]);

  return (
    <>
      {lines.slice(0, count).map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="leading-relaxed"
        >
          {line}
        </motion.div>
      ))}
    </>
  );
}
