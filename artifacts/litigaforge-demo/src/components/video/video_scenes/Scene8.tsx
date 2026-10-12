import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Disclosure, EASE } from '../TutorialUI';

const VERBS = ['OPEN', 'MAP', 'ANALYZE', 'VERIFY', 'TEST', 'SAVE'];

export function Scene8() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 250, callback: () => setBeat(1) },
    { time: 600, callback: () => setBeat(2) },
    { time: 1050, callback: () => setBeat(3) },
    { time: 1500, callback: () => setBeat(4) },
    { time: 1950, callback: () => setBeat(5) },
    { time: 2400, callback: () => setBeat(6) },
    { time: 3150, callback: () => setBeat(7) },
    { time: 4300, callback: () => setBeat(8) },
    { time: 5450, callback: () => setBeat(9) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 z-10 overflow-hidden bg-[#f1ede2] text-[#1a2744]"
      initial={{ opacity: 0, clipPath: 'inset(100% 0 0 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div className="absolute left-[6%] top-[16%] font-mono text-[1.25vmin] font-bold tracking-[0.18em] text-[#0d9488]">THE WORKSPACE ROUTE</div>
      <div className="absolute left-[6%] right-[6%] top-[34%] flex items-center justify-between border-b-[0.25vmin] border-[#c8d2cc] pb-[2vmin]">
        {VERBS.map((verb, i) => (
          <motion.div
            key={verb}
            className="relative flex flex-col items-center gap-[1.3vmin]"
            initial={{ opacity: 0, y: 16, scale: 0.86 }}
            animate={{ opacity: beat >= i + 1 ? 1 : 0, y: beat >= i + 1 ? 0 : 16, scale: beat >= i + 1 ? 1 : 0.86 }}
            transition={{ duration: 0.35, ease: EASE, type: 'spring', stiffness: 260, damping: 23 }}
          >
            <span className={`font-display text-[2.2vmin] font-semibold tracking-[-0.04em] ${i === 5 ? 'text-[#0d766e]' : 'text-[#314959]'}`}>{verb}</span>
            <span className={`h-[1.2vmin] w-[1.2vmin] rounded-sm ${i === 5 ? 'bg-[#0d9488]' : 'bg-[#f59e0b]'}`} />
          </motion.div>
        ))}
      </div>
      <motion.div
        className="absolute left-[6%] top-[54%] max-w-[65%] font-display text-[3vmin] leading-[1.18] tracking-[-0.04em] text-[#273f4d]"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: beat >= 7 ? 1 : 0, x: beat >= 7 ? 0 : -12 }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        Keep sources, scenarios,
        <br />
        and decisions distinct.
      </motion.div>
      <motion.div
        className="absolute right-[6%] top-[58%] text-right font-display text-[1.8vmin] font-semibold text-[#1a2744]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: beat >= 8 ? 1 : 0, y: beat >= 8 ? 0 : 10 }}
      >
        LitigaForge
        <span className="mt-[0.4vmin] block font-mono text-[1.05vmin] font-normal tracking-[0.08em] text-[#708082]">FORGE WORKSPACE</span>
      </motion.div>
      <motion.div
        className="absolute left-[89%] top-[34%] z-20 h-[2.6vmin] w-[2.6vmin] rounded-full border-[0.35vmin] border-[#0d9488]"
        animate={beat >= 9 ? { scale: [1, 2.5], x: '-82vw', opacity: [1, 1, 0] } : { opacity: 0 }}
        transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
      />
      <Disclosure />
    </motion.section>
  );
}
