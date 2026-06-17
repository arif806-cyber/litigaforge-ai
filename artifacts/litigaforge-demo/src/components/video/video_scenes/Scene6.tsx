import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  'Dashboard', 'Match & Connect', 'Forge Workspace',
  'Legal Q&A', 'Judgment Finder', 'Document Analyzer',
  'Templates', 'Legal Aid',
];

const TABS = [
  { id: 1, label: 'Case Strategy', color: '#0d9488' },
  { id: 2, label: 'Precedent Pack', color: '#a855f7' },
  { id: 3, label: 'Hearing Pack', color: '#f59e0b' },
  { id: 4, label: 'Client Memo', color: '#e2e8f0' },
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
            <span className="text-[1.3vw] font-display font-bold truncate">Property Dispute</span>
            <span className="px-2.5 py-1 bg-[#0d9488]/20 text-[#0d9488] text-[0.7vw] font-mono rounded-full border border-[#0d9488]/30 shrink-0">
              ACTIVE
            </span>
            <span className="text-[0.82vw] font-mono text-white/35 truncate hidden xl:block">
              Unauthorized Occupation
            </span>
          </div>
          <div className="flex items-center gap-5 text-[0.78vw] font-mono shrink-0">
            <span className="text-white/40">
              ⏱ Generated in{' '}
              <span className="text-[#0d9488] font-bold">47s</span>
            </span>
            <span className="text-white/40">
              Saved{' '}
              <span className="text-[#f59e0b] font-bold">14.3 hrs</span>
            </span>
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
          <div className="ml-auto flex items-center py-2">
            <div className="px-4 py-1.5 bg-[#0d9488]/15 border border-[#0d9488]/35 text-[#0d9488] text-[0.75vw] font-mono rounded-lg">
              Download All ↓
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {phase === 1 && (
              <Panel key="strategy">
                <StrategyPanel />
              </Panel>
            )}
            {phase === 2 && (
              <Panel key="precedent">
                <PrecedentPanel />
              </Panel>
            )}
            {phase === 3 && (
              <Panel key="hearing">
                <HearingPanel />
              </Panel>
            )}
            {phase === 4 && (
              <Panel key="memo">
                <MemoPanel />
              </Panel>
            )}
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

/* ─── Panel 1: Case Strategy ────────────────────────────────────── */
function StrategyPanel() {
  return (
    <div className="h-full flex flex-col gap-5">
      <div className="shrink-0">
        <h2 className="text-[2vw] font-display font-bold text-[#0d9488]">Case Strategy</h2>
        <p className="text-[0.82vw] font-mono text-white/35 mt-1">
          AI-synthesized legal roadmap · 3 phases · Est. 6–8 months
        </p>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">
        {[
          {
            step: '01',
            title: 'Issue Section 106 Notice',
            timing: 'Day 0',
            desc: 'Draft and serve statutory notice terminating month-to-month tenancy. 15-day period mandatory under TPA.',
          },
          {
            step: '02',
            title: 'File RC Suit for Possession',
            timing: 'Day 16+',
            desc: 'File suit for possession alongside mesne profits claim at prevailing market rate. Attach notice with postal receipts.',
          },
          {
            step: '03',
            title: 'Apply Interim Injunction',
            timing: 'Day 30+',
            desc: 'Restrain tenant from subletting or structural damage pending final order. Probability of grant: 78%.',
          },
        ].map((item, i) => (
          <motion.div
            key={i}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col overflow-hidden"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15, type: 'spring', bounce: 0.3 }}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-[2.2vw] font-display font-bold text-[#0d9488]/35 leading-none">
                {item.step}
              </span>
              <span className="px-2 py-1 text-[0.62vw] font-mono rounded-full border border-white/20 text-white/45">
                {item.timing}
              </span>
            </div>
            <h3 className="text-[0.95vw] font-display font-bold mb-3 leading-snug">{item.title}</h3>
            <p className="text-[0.78vw] font-mono text-white/55 flex-1 leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="bg-white/5 border border-white/10 rounded-xl p-4 shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex justify-between text-[0.8vw] font-mono mb-2">
          <span className="text-white/45">AI Confidence Score</span>
          <span className="text-[#0d9488] font-bold">92%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg,#0d9488,#a855f7)',
            }}
            initial={{ width: 0 }}
            animate={{ width: '92%' }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.6 }}
          />
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Panel 2: Precedent Pack ───────────────────────────────────── */
function PrecedentPanel() {
  const cases = [
    {
      court: 'Supreme Court of India',
      year: '2021',
      citation: 'AIR 2021 SC 1234',
      title: 'Mesne profits at prevailing market rate',
      quote:
        '"A tenant holding over after expiry of tenancy is liable to pay mesne profits at the market rate, not contractual rent."',
      tag: 'CRITICAL',
    },
    {
      court: 'High Court',
      year: '2019',
      citation: '2019 (3) MLJ 456',
      title: 'Section 106 — 15-day notice mandatory',
      quote:
        '"A notice to quit under Section 106 TPA must expressly grant the tenant 15 days to vacate to be legally valid."',
      tag: 'ESSENTIAL',
    },
    {
      court: 'Supreme Court of India',
      year: '2015',
      citation: 'AIR 2015 SC 789',
      title: "Landlord's bona fide need — subjective test",
      quote:
        '"The bona fide need of the landlord is a subjective determination; honest belief suffices."',
      tag: 'SUPPORTING',
    },
  ];

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="shrink-0">
        <h2 className="text-[2vw] font-display font-bold text-[#a855f7]">Precedent Pack</h2>
        <p className="text-[0.82vw] font-mono text-white/35 mt-1">
          12 relevant cases found · Top 3 selected · Court-ready citations
        </p>
      </div>
      <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
        {cases.map((c, i) => (
          <motion.div
            key={i}
            className="bg-white/5 border-l-4 border-[#a855f7] rounded-r-2xl p-5 flex gap-5 shrink-0"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.18 }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <span className="text-[0.95vw] font-display font-bold">{c.title}</span>
                <span
                  className="text-[0.65vw] font-mono px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: '#a855f720',
                    color: '#a855f7',
                    border: '1px solid #a855f745',
                  }}
                >
                  {c.tag}
                </span>
              </div>
              <p className="text-[0.75vw] font-mono text-white/35 mb-2">
                {c.court} · {c.year} · {c.citation}
              </p>
              <p className="text-[0.82vw] font-mono text-white/65 italic leading-relaxed">{c.quote}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Panel 3: Hearing Pack ─────────────────────────────────────── */
function HearingPanel() {
  return (
    <div className="h-full flex flex-col gap-5">
      <div className="shrink-0">
        <h2 className="text-[2vw] font-display font-bold text-[#f59e0b]">Hearing Preparation Pack</h2>
        <p className="text-[0.82vw] font-mono text-white/35 mt-1">
          District Court · AI-prepared · Ready to use
        </p>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-5 min-h-0">
        <motion.div
          className="bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-[0.95vw] font-display font-bold mb-4 text-[#f59e0b]">Required Exhibits</h3>
          <ul className="space-y-3">
            {[
              'Original Lease Deed',
              'Rent Payment Ledger (6 mo)',
              'Legal Notice Copy (Exh. A)',
              'Postal Receipts + Acknowledgement',
              'Property Tax Records',
            ].map((item, i) => (
              <motion.li
                key={i}
                className="flex items-center gap-3 text-[0.82vw] font-mono text-white/65"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <div className="w-5 h-5 rounded bg-[#f59e0b]/15 border border-[#f59e0b]/40 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 bg-[#f59e0b] rounded-sm" />
                </div>
                {item}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <div className="flex flex-col gap-4">
          <motion.div
            className="bg-white/5 border border-white/10 rounded-2xl p-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-[0.95vw] font-display font-bold mb-4 text-[#f59e0b]">Witnesses</h3>
            <ul className="space-y-3">
              {['Plaintiff (Landlord) — Primary', 'Bank Manager — Rent records'].map((w, i) => (
                <li key={i} className="flex items-center gap-3 text-[0.82vw] font-mono text-white/65">
                  <div className="w-5 h-5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/40 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="bg-white/5 border border-white/10 rounded-2xl p-6 flex-1"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-[0.95vw] font-display font-bold mb-4 text-[#f59e0b]">Key Arguments</h3>
            <ul className="space-y-2.5">
              {[
                'Tenant holding over — no renewal',
                'Section 106 notice duly served',
                'Mesne profits at market rate',
                'No valid defense identified',
              ].map((a, i) => (
                <li
                  key={i}
                  className="text-[0.8vw] font-mono text-white/65 flex items-start gap-2"
                >
                  <span className="text-[#f59e0b] shrink-0 mt-0.5">→</span>
                  {a}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ─── Panel 4: Client Memo ──────────────────────────────────────── */
function MemoPanel() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0">
        <h2 className="text-[2vw] font-display font-bold text-white">Client Memo</h2>
        <p className="text-[0.82vw] font-mono text-white/35 mt-1">
          Ready to send · Professional format · AI-drafted
        </p>
      </div>

      <motion.div
        className="flex-1 bg-white rounded-2xl shadow-2xl relative overflow-hidden min-h-0"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.3 }}
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#0d9488]" />
        <div className="p-8 h-full flex flex-col overflow-hidden">
          <div className="flex justify-between items-start mb-5 shrink-0">
            <div>
              <p className="text-[0.68vw] font-mono text-gray-400 tracking-widest uppercase">
                Privileged &amp; Confidential
              </p>
              <p className="text-[0.68vw] font-mono text-gray-400 mt-0.5">
                Prepared by LitigaForge Forge AI · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-[#0d9488] text-white text-[0.72vw] font-mono rounded-lg cursor-pointer">
                Send Now
              </div>
              <div className="px-4 py-2 border border-gray-200 text-gray-500 text-[0.72vw] font-mono rounded-lg cursor-pointer">
                Download PDF
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <p className="text-[1vw] text-gray-800 font-sans font-semibold mb-4">Dear Client,</p>
            <motion.div
              className="text-[0.85vw] text-gray-700 font-sans leading-relaxed space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              <p>
                We have completed our comprehensive review of your property dispute matter involving
                unauthorized occupation of the premises. Our AI-powered Forge Workspace has prepared
                a complete legal package for your matter.
              </p>
              <p>
                The strategy involves issuing an immediate <strong>Section 106 Notice</strong>,
                followed by filing a Recovery of Possession suit with a claim for mesne profits at
                the prevailing market rate. Our precedent research has identified{' '}
                <strong>12 binding authorities</strong> strongly in your favour.
              </p>
              <p>
                Our assessment indicates a{' '}
                <strong className="text-[#0d9488]">94% probability of a favourable outcome</strong>.
                Estimated resolution timeline is 6–8 months from filing.
              </p>
              <p className="text-gray-400 text-[0.75vw]">
                Please review and confirm to proceed. All attached documents are court-ready and
                available for immediate download.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
