import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  'Dashboard', 'Match & Connect', 'Forge Workspace',
  'Legal Q&A', 'Judgment Finder', 'Document Analyzer',
  'Templates', 'Legal Aid',
];

const TABS = [
  { id: 1, label: 'Executive Summary', color: '#0d9488' },
  { id: 2, label: 'Key Judgments', color: '#a855f7' },
  { id: 3, label: 'Draft Petition', color: '#f59e0b' },
  { id: 4, label: 'Fee & Invoice', color: '#60a5fa' },
];

export function Scene6() {
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(2), 3000),
      setTimeout(() => setPhase(3), 6000),
      setTimeout(() => setPhase(4), 9000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const activeTab = TABS[phase - 1];

  return (
    <motion.div
      className="absolute inset-0 flex bg-[#0a1628] z-20 text-white overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8 }}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right,#fff2 1px,transparent 1px),linear-gradient(to bottom,#fff2 1px,transparent 1px)`,
          backgroundSize: '4vw 4vw',
        }}
      />

      {/* Nav Sidebar */}
      <div className="w-[18vw] min-w-[110px] h-full bg-[#1a2744] border-r border-white/10 flex flex-col px-5 py-10 z-30 shrink-0">
        <div className="mb-12 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#0d9488] flex items-center justify-center shrink-0">
            <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
          </div>
          <span className="text-[1.1vw] font-display font-bold truncate">LitigaForge</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => (
            <div
              key={item}
              className={`px-3 py-2.5 rounded-xl text-[0.85vw] font-mono ${
                item === 'Forge Workspace'
                  ? 'bg-[#0d9488] text-white font-bold'
                  : 'text-white/50'
              }`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col z-20 overflow-hidden min-w-0">

        {/* Top Header */}
        <div className="px-8 py-4 border-b border-white/10 bg-white/3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[1.3vw] font-display font-bold truncate">MACT Compensation</span>
            <span className="px-2.5 py-1 bg-[#0d9488]/20 text-[#0d9488] text-[0.7vw] font-mono rounded-full border border-[#0d9488]/30 shrink-0">
              ACTIVE
            </span>
            <span className="text-[0.82vw] font-mono text-white/35 truncate hidden xl:block">
              Motor Accident · Hyderabad District Court
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <motion.div
                className="px-3.5 py-1.5 text-[0.72vw] font-mono rounded-lg cursor-pointer flex items-center gap-1.5"
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', color: '#c084fc' }}
                animate={{ boxShadow: ['0 0 0px #a855f700', '0 0 14px #a855f755', '0 0 0px #a855f700'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                📄 Export PDF
              </motion.div>
              <motion.div
                className="px-3.5 py-1.5 text-[0.72vw] font-mono rounded-lg cursor-pointer flex items-center gap-1.5"
                style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd' }}
                animate={{ boxShadow: ['0 0 0px #60a5fa00', '0 0 14px #60a5fa55', '0 0 0px #60a5fa00'] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              >
                🧾 Invoice
              </motion.div>
            </div>
            <div className="flex items-center gap-3 text-[0.75vw] font-mono">
              <span className="text-white/40">
                ⏱ Generated in <span className="text-[#0d9488] font-bold">52s</span>
              </span>
              <span className="text-white/40">
                Saved <span className="text-[#f59e0b] font-bold">16h</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-stretch border-b border-white/10 shrink-0 px-8 gap-1">
          {TABS.map((tab) => {
            const isActive = phase === tab.id;
            return (
              <div
                key={tab.id}
                className="relative px-5 py-3 text-[0.82vw] font-mono transition-colors"
                style={{ color: isActive ? tab.color : 'rgba(255,255,255,0.35)' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                    style={{ backgroundColor: tab.color }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                {isActive && <span className="mr-1">▸</span>}
                {tab.label}
              </div>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {phase === 1 && <Panel key="summary"><SummaryPanel /></Panel>}
            {phase === 2 && <Panel key="judgments"><JudgmentsPanel /></Panel>}
            {phase === 3 && <Panel key="petition"><PetitionPanel /></Panel>}
            {phase === 4 && <Panel key="fee"><FeePanel /></Panel>}
          </AnimatePresence>
        </div>

        {/* Bottom Status Bar */}
        <div className="px-8 py-3 border-t border-white/10 bg-black/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5 text-[0.72vw] font-mono">
            {TABS.map((tab) => (
              <motion.span
                key={tab.id}
                animate={{ opacity: phase >= tab.id ? 1 : 0.3 }}
                style={{ color: phase >= tab.id ? tab.color : 'rgba(255,255,255,0.3)' }}
              >
                {phase >= tab.id ? '✓' : '○'} {tab.label}
              </motion.span>
            ))}
          </div>
          <motion.span
            className="text-[0.85vw] font-display font-bold"
            style={{ color: activeTab.color }}
            key={phase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {phase === 4 ? 'The most powerful legal workspace ever built.' : `Deliverable ${phase} of 4 ready`}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="absolute inset-0 p-8 overflow-hidden"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-15%', opacity: 0 }}
      transition={{ duration: 0.52, ease: [0.76, 0, 0.24, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Panel 1: Executive Summary ───────────────────────────────── */
function SummaryPanel() {
  const bullets = [
    { label: 'Claim Type', value: 'MACT Compensation u/s 166 MV Act, 1988', color: '#0d9488' },
    { label: 'Forum', value: 'Motor Accidents Claims Tribunal, Hyderabad', color: '#0d9488' },
    { label: 'Compensation Est.', value: '₹45–65 Lakhs (Sarla Verma multiplier)', color: '#f59e0b' },
    { label: 'Limitation', value: '3 years from date of accident — within time', color: '#34d399' },
    { label: 'Win Probability', value: '91% based on 5 IK binding precedents', color: '#34d399' },
    { label: 'Interim Relief', value: 'Solatium u/s 164A — eligible, apply immediately', color: '#a855f7' },
  ];
  return (
    <div className="h-full flex flex-col gap-5">
      <div className="shrink-0">
        <h2 className="text-[2vw] font-display font-bold text-[#0d9488]">Executive Summary</h2>
        <p className="text-[0.82vw] font-mono text-white/35 mt-1">
          AI-synthesized from 3 agents · 5 live IndianKanoon judgments · Court-ready
        </p>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {bullets.map((b, i) => (
          <motion.div
            key={i}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: 'spring', bounce: 0.3 }}
          >
            <p className="text-[0.68vw] font-mono text-white/35 uppercase tracking-wider mb-2">{b.label}</p>
            <p className="text-[0.88vw] font-display font-bold leading-snug" style={{ color: b.color }}>
              {b.value}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Panel 2: Key Judgments (IK Live) ─────────────────────────── */
function JudgmentsPanel() {
  const cases = [
    {
      title: 'Sarla Verma v. Delhi Transport Corp.',
      citation: '(2009) 6 SCC 121',
      court: 'Supreme Court of India',
      tag: 'BINDING',
      tagColor: '#a855f7',
      quote: '"The multiplier method shall be the uniform basis for computing compensation under the MV Act."',
      source: 'IndianKanoon live',
    },
    {
      title: 'National Insurance Co. v. Pranay Sethi',
      citation: '(2017) 16 SCC 680',
      court: 'Supreme Court of India',
      tag: 'CRITICAL',
      tagColor: '#f59e0b',
      quote: '"Future prospects at 40% for salaried, 25% for self-employed below 40 years — mandatory addition."',
      source: 'IndianKanoon live',
    },
    {
      title: 'Oriental Insurance v. Syed Ibrahim',
      citation: '2022 (1) TS 342',
      court: 'Telangana High Court',
      tag: 'LOCAL PRECEDENT',
      tagColor: '#0d9488',
      quote: '"Telangana courts must apply Pranay Sethi formula uniformly irrespective of insurer objection."',
      source: 'IndianKanoon live',
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-[2vw] font-display font-bold text-[#a855f7]">Key Judgments</h2>
          <p className="text-[0.82vw] font-mono text-white/35 mt-1">
            5 judgments fetched live · Top 3 injected · Court-ready citations
          </p>
        </div>
        <motion.div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[0.7vw] font-mono"
          style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)', color: '#c084fc' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />
          IndianKanoon API · Live
        </motion.div>
      </div>
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
        {cases.map((c, i) => (
          <motion.div
            key={i}
            className="rounded-2xl p-4 flex gap-4 shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', borderLeft: `4px solid ${c.tagColor}` }}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.18 }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <span className="text-[0.9vw] font-display font-bold">{c.title}</span>
                <span
                  className="text-[0.62vw] font-mono px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: `${c.tagColor}20`, color: c.tagColor, border: `1px solid ${c.tagColor}45` }}
                >
                  {c.tag}
                </span>
              </div>
              <p className="text-[0.7vw] font-mono mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {c.court} · {c.citation}
              </p>
              <p className="text-[0.78vw] font-mono italic leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {c.quote}
              </p>
            </div>
            <div
              className="shrink-0 text-[0.6vw] font-mono px-2 py-1 rounded-lg self-start mt-0.5"
              style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}
            >
              {c.source}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Panel 3: Draft Petition ───────────────────────────────────── */
function PetitionPanel() {
  return (
    <div className="h-full flex flex-col gap-5">
      <div className="shrink-0">
        <h2 className="text-[2vw] font-display font-bold text-[#f59e0b]">Draft Petition</h2>
        <p className="text-[0.82vw] font-mono text-white/35 mt-1">
          District Court ready · MACT format · 5 IK citations embedded
        </p>
      </div>

      <motion.div
        className="flex-1 bg-white rounded-2xl shadow-2xl relative overflow-hidden min-h-0"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.3 }}
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#f59e0b]" />
        <div className="p-6 h-full flex flex-col overflow-hidden">
          <div className="flex justify-between items-start mb-4 shrink-0">
            <div>
              <p className="text-[0.65vw] font-mono text-gray-400 tracking-widest uppercase">Draft · Privileged & Confidential</p>
              <p className="text-[0.65vw] font-mono text-gray-400 mt-0.5">
                LitigaForge Forge AI · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 bg-[#f59e0b] text-white text-[0.68vw] font-mono rounded-lg cursor-pointer">
                Download PDF
              </div>
              <div className="px-3 py-1.5 border border-gray-200 text-gray-500 text-[0.68vw] font-mono rounded-lg cursor-pointer">
                Edit Draft
              </div>
            </div>
          </div>

          <motion.div
            className="flex-1 overflow-hidden text-[0.8vw] text-gray-700 font-sans leading-relaxed space-y-2.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <p className="font-bold text-gray-800 text-[0.92vw]">
              IN THE MOTOR ACCIDENTS CLAIMS TRIBUNAL, HYDERABAD
            </p>
            <p className="font-semibold text-gray-700">MACT Case No. ___ / 2026</p>
            <div className="border-l-2 border-gray-200 pl-3 text-[0.75vw] text-gray-500 space-y-1">
              <p>Petitioner: [Victim's Family] — hereinafter "Claimants"</p>
              <p>Respondents: (1) Owner of Vehicle, (2) Driver, (3) Insurance Co.</p>
            </div>
            <p className="font-bold text-gray-800">CLAIM PETITION U/S 166, MV ACT 1988</p>
            <p>
              The Claimants respectfully submit that on [date], the deceased was fatally injured in a motor
              vehicle accident caused by the rash and negligent driving of Respondent No. 2. As per{' '}
              <strong>Sarla Verma v. DTC (2009) 6 SCC 121</strong>, compensation shall be computed using the
              structured multiplier formula, with <strong>+40% future prospects</strong> as mandated by{' '}
              <strong>Pranay Sethi (2017) 16 SCC 680</strong>.
            </p>
            <p className="text-gray-400 text-[0.7vw]">
              … [continues — all IK citations auto-embedded · 8 pages court-ready]
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Panel 4: Fee & Invoice ────────────────────────────────────── */
function FeePanel() {
  const items = [
    { desc: 'MACT Petition Filing & Representation', amount: '₹15,000' },
    { desc: 'Research & Precedent Analysis (5 IK judgments)', amount: '₹8,000' },
    { desc: 'Hearing Preparation Pack', amount: '₹5,000' },
    { desc: 'AI Document Drafting (Forge Workspace)', amount: '₹4,500' },
    { desc: 'Success fee on award (5% of compensation)', amount: 'Variable' },
  ];

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="shrink-0">
        <h2 className="text-[2vw] font-display font-bold text-[#60a5fa]">Fee Recommendation & Invoice</h2>
        <p className="text-[0.82vw] font-mono text-white/35 mt-1">
          AI-benchmarked · Bar Council compliant · Instant PDF invoice
        </p>
      </div>

      <div className="flex-1 flex gap-5 min-h-0">
        {/* Invoice table */}
        <motion.div
          className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', bounce: 0.3 }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#60a5fa] rounded-t-2xl" />
          <div className="p-5 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <p className="text-[0.85vw] font-bold text-gray-800">Fee Estimate · LitigaForge</p>
              <span className="text-[0.65vw] font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded-full border border-blue-200">
                DRAFT
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-hidden">
              {items.map((item, i) => (
                <motion.div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12 }}
                >
                  <p className="text-[0.72vw] text-gray-600 font-sans flex-1 pr-3">{item.desc}</p>
                  <p className="text-[0.8vw] font-bold text-gray-800 shrink-0 font-mono">{item.amount}</p>
                </motion.div>
              ))}
            </div>
            <motion.div
              className="mt-4 pt-3 border-t-2 border-gray-200 flex justify-between items-center shrink-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <p className="text-[0.8vw] font-bold text-gray-800">Upfront Retainer</p>
              <p className="text-[1.1vw] font-black text-[#60a5fa]">₹32,500</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="w-[22%] flex flex-col gap-3"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="rounded-2xl p-5 flex flex-col items-center text-center gap-2 cursor-pointer"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)' }}
            animate={{ boxShadow: ['0 0 0px #a855f700', '0 0 20px #a855f740', '0 0 0px #a855f700'] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <span className="text-[1.8vw]">📄</span>
            <p className="text-[0.78vw] font-bold" style={{ color: '#c084fc' }}>Download PDF</p>
            <p className="text-[0.62vw] font-mono text-white/40">Lawyer Package</p>
          </motion.div>
          <motion.div
            className="rounded-2xl p-5 flex flex-col items-center text-center gap-2 cursor-pointer"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.4)' }}
            animate={{ boxShadow: ['0 0 0px #60a5fa00', '0 0 20px #60a5fa40', '0 0 0px #60a5fa00'] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 }}
          >
            <span className="text-[1.8vw]">🧾</span>
            <p className="text-[0.78vw] font-bold" style={{ color: '#93c5fd' }}>Generate Invoice</p>
            <p className="text-[0.62vw] font-mono text-white/40">Client-ready</p>
          </motion.div>
          <div
            className="flex-1 rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[0.65vw] font-mono text-white/30 uppercase tracking-wider">AI benchmark</p>
            <p className="text-[0.72vw] font-mono text-white/60">Hyderabad avg MACT retainer: ₹28k–₹40k</p>
            <p className="text-[0.7vw] font-mono text-green-400">✓ Market-rate compliant</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
