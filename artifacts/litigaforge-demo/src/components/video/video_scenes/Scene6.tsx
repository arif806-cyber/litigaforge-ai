import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  'Dashboard', 'Match & Connect', 'Forge Workspace',
  'Legal Q&A', 'Judgment Finder', 'Document Analyzer',
  'Templates', 'Legal Aid',
];

const DOCS = [
  {
    icon: '📋',
    type: 'LAWYER PACKAGE',
    name: 'Lawyer_Package_20260618.pdf',
    size: '342 KB',
    color: '#0d9488',
    desc: '6-section court-ready: Executive Summary · Advisory · Petition · Action Plan',
    phase: 1,
  },
  {
    icon: '📊',
    type: 'ANALYSIS REPORT',
    name: 'Analysis_Report_20260618.pdf',
    size: '287 KB',
    color: '#a855f7',
    desc: 'All 5 agents synthesised: Research · Strategy · Risk · Drafting · Compliance',
    phase: 2,
  },
  {
    icon: '⚖️',
    type: 'VAKALATNAMA',
    name: 'Vakalatnama_20260618.pdf',
    size: '94 KB',
    color: '#f59e0b',
    desc: 'Power of attorney — standard Indian court format, dual signature block, ready to sign',
    phase: 3,
  },
  {
    icon: '🧾',
    type: 'FEE INVOICE',
    name: 'Invoice_20260618.pdf',
    size: '58 KB',
    color: '#60a5fa',
    desc: 'AI-benchmarked fee estimate · Bar Council compliant · client-ready PDF',
    phase: 4,
  },
];

const STARS = Array.from({ length: 10 }, (_, i) => ({
  top: 5 + (i * 79 % 88),
  left: 15 + (i * 67 % 80),
  dur: 3 + (i % 4),
}));

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // Lawyer Package
      setTimeout(() => setPhase(2), 3200),  // Analysis Report
      setTimeout(() => setPhase(3), 5900),  // Vakalatnama
      setTimeout(() => setPhase(4), 8600),  // Invoice + download pulse
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex bg-[#0a1628] z-20 text-white overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8 }}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right,#fff2 1px,transparent 1px),linear-gradient(to bottom,#fff2 1px,transparent 1px)`,
          backgroundSize: '4vw 4vw',
        }}
      />

      {/* Subtle stars */}
      {STARS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-0.5 bg-white rounded-full pointer-events-none"
          style={{ top: `${s.top}%`, left: `${s.left}%` }}
          animate={{ opacity: [0.1, 0.5, 0.1], scale: [1, 1.4, 1] }}
          transition={{ duration: s.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Nav Sidebar */}
      <motion.div
        className="w-[18vw] min-w-[110px] h-full bg-[#1a2744] border-r border-white/10 flex flex-col px-5 py-10 z-30 shrink-0"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
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

        {/* Folder in sidebar */}
        <motion.div
          className="mt-auto rounded-xl p-3"
          style={{ background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <p className="text-[0.65vw] font-mono text-[#0d9488] font-bold mb-1">📁 Case Folder</p>
          <p className="text-[0.6vw] font-mono text-white/35 truncate">MACT_Motor_Accident…</p>
          <p className="text-[0.58vw] font-mono text-white/25 mt-0.5">4 documents · 781 KB</p>
        </motion.div>
      </motion.div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col z-20 overflow-hidden min-w-0">

        {/* Header */}
        <motion.div
          className="px-8 py-4 border-b border-white/10 flex items-center justify-between shrink-0"
          style={{ background: 'rgba(255,255,255,0.02)' }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <div className="flex items-center gap-4 min-w-0">
            <motion.span
              className="text-[2vw] shrink-0"
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              📁
            </motion.span>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[1.4vw] font-display font-bold text-[#0d9488]">Case Folder</h1>
                <span
                  className="text-[0.6vw] font-mono px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: 'rgba(13,148,136,0.15)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.35)' }}
                >
                  AUTO-GENERATED
                </span>
              </div>
              <p className="text-[0.68vw] font-mono text-white/30 mt-0.5 truncate">
                MACT_Motor_Accident_20260618 · Forge Workspace · 18 Jun 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 text-[0.72vw] font-mono">
            <div className="text-white/35">
              4 documents · <span className="text-white/60">781 KB</span>
            </div>
            <div className="text-white/35">
              Generated in <span className="text-[#0d9488] font-bold">52s</span>
              {' · '}Saved <span className="text-[#f59e0b] font-bold">16h</span>
            </div>
          </div>
        </motion.div>

        {/* Column headers */}
        <motion.div
          className="px-8 py-2 border-b border-white/5 flex items-center gap-5 shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="w-8 shrink-0" />
          <div className="w-[24vw] shrink-0 text-[0.58vw] font-mono text-white/20 uppercase tracking-widest">Document</div>
          <div className="flex-1 text-[0.58vw] font-mono text-white/20 uppercase tracking-widest">Description</div>
          <div className="w-[5vw] text-right shrink-0 text-[0.58vw] font-mono text-white/20 uppercase tracking-widest">Size</div>
          <div className="w-[9vw] shrink-0" />
        </motion.div>

        {/* Document rows */}
        <div className="flex-1 px-6 py-4 flex flex-col gap-3 min-h-0 overflow-hidden">
          {DOCS.map((doc, idx) => (
            <AnimatePresence key={doc.type}>
              {phase >= doc.phase && (
                <motion.div
                  initial={{ opacity: 0, x: 32, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                  className="flex items-center gap-5 rounded-2xl px-5 py-3.5 relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${doc.color}09 0%, transparent 60%)`,
                    border: `1px solid ${doc.color}25`,
                  }}
                >
                  {/* Left accent bar */}
                  <div
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                    style={{ background: doc.color }}
                  />

                  {/* Icon */}
                  <span className="text-[1.9vw] shrink-0 ml-1">{doc.icon}</span>

                  {/* Type + filename */}
                  <div className="w-[24vw] shrink-0 min-w-0">
                    <div
                      className="text-[0.58vw] font-mono font-bold tracking-widest mb-0.5"
                      style={{ color: doc.color }}
                    >
                      {doc.type}
                    </div>
                    <div className="text-[0.78vw] font-mono text-white/75 truncate">{doc.name}</div>
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.7vw] font-mono text-white/40 leading-relaxed truncate">{doc.desc}</p>
                  </div>

                  {/* Size */}
                  <div className="w-[5vw] text-right shrink-0">
                    <p className="text-[0.7vw] font-mono text-white/30">{doc.size}</p>
                  </div>

                  {/* Download button */}
                  <motion.div
                    className="w-[9vw] shrink-0 rounded-xl py-2 text-[0.68vw] font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer select-none"
                    style={{
                      background: `${doc.color}18`,
                      border: `1px solid ${doc.color}40`,
                      color: doc.color,
                    }}
                    animate={
                      phase >= 4
                        ? {
                            boxShadow: [
                              `0 0 0px ${doc.color}00`,
                              `0 0 16px ${doc.color}55`,
                              `0 0 0px ${doc.color}00`,
                            ],
                          }
                        : {}
                    }
                    transition={{ duration: 2.2, repeat: Infinity, delay: idx * 0.28 }}
                  >
                    ↓ Download
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          ))}
        </div>

        {/* Status bar */}
        <motion.div
          className="px-8 py-3 border-t border-white/8 flex items-center justify-between shrink-0"
          style={{ background: 'rgba(0,0,0,0.25)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center gap-5 text-[0.68vw] font-mono">
            {DOCS.map((d) => (
              <motion.span
                key={d.type}
                style={{ color: phase >= d.phase ? d.color : 'rgba(255,255,255,0.2)' }}
                animate={{ opacity: phase >= d.phase ? 1 : 0.3 }}
              >
                {phase >= d.phase ? '✓' : '○'} {d.type.split(' ')[0]}
              </motion.span>
            ))}
          </div>
          <motion.span
            className="text-[0.82vw] font-display font-bold"
            style={{ color: '#0d9488' }}
            animate={phase >= 4 ? { opacity: [0.7, 1, 0.7] } : { opacity: 0.7 }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            Every document. One click. Zero effort.
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}
