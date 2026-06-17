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

const AGENTS = [
  {
    name: 'Claude Sonnet 4',
    role: 'Precedent Research',
    color: '#a855f7',
    lines: [
      'Scanning 12,847 case records...',
      'Filtered to 12 binding precedents',
      'AIR 2021 SC: Mesne profits at',
      '  market rate — STRONG ✓',
      '2019 HC: Sec 106 — 15-day',
      '  notice mandatory — CRITICAL ✓',
      'Precedent strength: VERY HIGH',
    ],
  },
  {
    name: 'Gemini 2.5 Flash',
    role: 'Procedural Strategy',
    color: '#0d9488',
    lines: [
      'Case: Unauthorized occupation',
      'Day  0 → Issue Sec 106 Notice',
      'Day 16 → File RC Suit (possession)',
      'Day 30 → Apply interim injunction',
      'Day 90 → Evidence filing deadline',
      'Win probability: 94% ✓',
      'Est. resolution: 6–8 months',
    ],
  },
  {
    name: 'GPT-5 Omni',
    role: 'Risk Analysis',
    color: '#f59e0b',
    lines: [
      'Legal basis: STRONG (Sec 106)',
      'Tenant defense: None identified ✓',
      'Evidence strength: 8.7 / 10',
      'Financial exposure: NEGLIGIBLE',
      'Counter-claim risk: LOW (12%)',
      'Costs awarded: LIKELY ✓',
      'Overall risk rating: LOW ★★★★★',
    ],
  },
];

const DELIVERABLES = ['Case Strategy', 'Precedent Pack', 'Hearing Pack', 'Client Memo'];

export function Scene5() {
  const [phase, setPhase] = useState(0);
  const [synthPct, setSynthPct] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 3200),
      setTimeout(() => setPhase(4), 4800),
      setTimeout(() => setPhase(5), 9500),
      setTimeout(() => setPhase(6), 12200),
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
      <div className="flex-1 flex flex-col p-8 gap-5 overflow-hidden z-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h1 className="text-[3vw] font-display font-bold text-[#0d9488] leading-none">
            Forge Workspace
          </h1>
          <p className="text-[0.85vw] font-mono text-white/35 tracking-widest mt-1">
            MULTI-AGENT LEGAL INTELLIGENCE  ·  CLAUDE + GEMINI + GPT-5
          </p>
        </motion.div>

        {/* Prompt Box */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              className="bg-white/5 border border-white/15 rounded-2xl p-5 backdrop-blur-sm shrink-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.3 }}
            >
              <p className="text-[0.72vw] font-mono text-white/30 mb-3 tracking-wider uppercase">
                Case  ›  Property Dispute · Unauthorized Occupation
              </p>
              <div className="flex items-center gap-4">
                <p className="flex-1 text-[0.95vw] font-mono text-white/80 leading-relaxed">
                  "Generate complete case strategy, precedent research, and
                  hearing preparation pack for this property dispute."
                </p>
                <motion.div
                  className="shrink-0 px-5 py-2.5 bg-[#0d9488] text-white text-[0.9vw] font-display font-bold rounded-xl cursor-pointer select-none"
                  animate={
                    phase === 2
                      ? {
                          boxShadow: [
                            '0 0 0px #0d948800',
                            '0 0 28px #0d948880',
                            '0 0 0px #0d948800',
                          ],
                        }
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

        {/* Agent Panels */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.name}
              className="flex-1 bg-[#0d1b30] border border-white/10 rounded-2xl p-5 flex flex-col overflow-hidden relative"
              initial={{ opacity: 0, y: 30 }}
              animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                initial={{ opacity: 0 }}
                animate={phase >= 3 ? { opacity: 0.12 } : {}}
                transition={{ duration: 1.5, delay: i * 0.15 }}
                style={{
                  background: `radial-gradient(circle at 50% 0%,${agent.color},transparent 70%)`,
                }}
              />

              <div className="flex items-center gap-3 mb-4 relative z-10 shrink-0">
                <div
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor: agent.color,
                    boxShadow: `0 0 14px ${agent.color}50`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.85vw] font-display font-bold truncate">{agent.name}</p>
                  <p
                    className="text-[0.72vw] font-mono truncate"
                    style={{ color: agent.color }}
                  >
                    {agent.role}
                  </p>
                </div>
                {phase >= 4 && (
                  <motion.span
                    className="ml-auto text-[0.65vw] font-mono px-2 py-1 rounded-full border shrink-0"
                    style={{ color: agent.color, borderColor: `${agent.color}60` }}
                    animate={
                      phase >= 5
                        ? { opacity: 1 }
                        : { opacity: [1, 0.4, 1] }
                    }
                    transition={{ duration: 0.8, repeat: phase >= 5 ? 0 : Infinity }}
                  >
                    {phase >= 5 ? '✓ DONE' : 'ANALYZING'}
                  </motion.span>
                )}
              </div>

              <div className="flex-1 bg-black/40 rounded-xl p-3 font-mono text-[0.72vw] text-white/70 overflow-hidden relative z-10 border border-white/5 min-h-0">
                {phase >= 4 && (
                  <StreamingLines lines={agent.lines} delayS={i * 0.35} />
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Synthesis Row */}
        {phase >= 5 && (
          <motion.div
            className="bg-white/5 border border-[#0d9488]/40 rounded-xl p-4 shrink-0"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-between text-[0.8vw] font-mono mb-2">
              <span className="text-[#0d9488]">
                {phase >= 6
                  ? '✓  FORGE SYNTHESIS COMPLETE'
                  : '⟳  SYNTHESIZING 3 AGENTS...'}
              </span>
              <span className="text-white/50">
                {phase >= 6
                  ? '4 deliverables ready  ·  14.3 hrs saved'
                  : `${Math.round((phase >= 6 ? 1 : synthPct) * 100)}%`}
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${(phase >= 6 ? 1 : synthPct) * 100}%`,
                  background:
                    'linear-gradient(90deg,#a855f7,#0d9488 50%,#f59e0b)',
                }}
                transition={{ duration: 0.05 }}
              />
            </div>
          </motion.div>
        )}

        {/* Package Ready */}
        {phase >= 6 && (
          <motion.div
            className="flex gap-3 shrink-0"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0.4 }}
          >
            {DELIVERABLES.map((doc, i) => (
              <motion.div
                key={doc}
                className="flex-1 bg-[#0d9488]/10 border border-[#0d9488]/30 rounded-xl px-4 py-3 text-center"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, type: 'spring', bounce: 0.45 }}
              >
                <div className="w-5 h-5 bg-[#0d9488] rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-white rounded-sm" />
                </div>
                <p className="text-[0.72vw] font-mono text-white/70 leading-tight">{doc}</p>
                <p className="text-[0.62vw] font-mono text-[#0d9488] mt-1">Ready ↓</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function StreamingLines({
  lines,
  delayS = 0,
}: {
  lines: string[];
  delayS?: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let intId: ReturnType<typeof setInterval>;
    const timeId = setTimeout(() => {
      intId = setInterval(() => {
        setCount((c) => {
          if (c >= lines.length) {
            clearInterval(intId);
            return c;
          }
          return c + 1;
        });
      }, 580);
    }, delayS * 1000);
    return () => {
      clearTimeout(timeId);
      clearInterval(intId);
    };
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
              ? 'text-white/40'
              : line.includes('✓')
              ? 'text-green-400'
              : 'text-white/70'
          }
        >
          {line}
        </motion.p>
      ))}
      {count < lines.length && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.75, repeat: Infinity }}
        >
          ▊
        </motion.span>
      )}
    </div>
  );
}
