import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Disclosure, EASE, StepTitle, Tag } from '../TutorialUI';

const AGENTS = ['Research', 'Strategy', 'Risk', 'Drafting', 'Predictive'];

export function Scene4() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 400, callback: () => setBeat(1) },
    { time: 1200, callback: () => setBeat(2) },
    { time: 2300, callback: () => setBeat(3) },
    { time: 4100, callback: () => setBeat(4) },
    { time: 6200, callback: () => setBeat(5) },
    { time: 7200, callback: () => setBeat(6) },
    { time: 8500, callback: () => setBeat(7) },
    { time: 9700, callback: () => setBeat(8) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 z-10 overflow-hidden bg-[#eaf0ef] text-[#1a2744]"
      initial={{ opacity: 0, x: '3%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 1.025 }}
      transition={{ duration: 0.52, ease: EASE }}
    >
      <div className="absolute left-[5.5%] top-[7%] z-10">
        <StepTitle number="03 /" title="Run, wait, then ask" />
        <motion.div className="mt-[1.2vmin] flex items-center gap-[1.2vmin]" animate={{ opacity: beat >= 1 ? 1 : 0 }}>
          <span className="rounded-lg bg-[#0d9488] px-[1.7vmin] py-[0.9vmin] font-display text-[1.3vmin] font-semibold text-white">Run Agent Analysis</span>
          <span className="font-mono text-[1.1vmin] text-[#768588]">illustrative control</span>
        </motion.div>
      </div>
      <div className="absolute left-[5.5%] right-[5.5%] top-[29%] bottom-[10%] grid grid-cols-6 grid-rows-2 gap-[1.35vmin]">
        {AGENTS.map((agent, i) => {
          const done = beat >= 5 || (beat >= 4 && i < 2);
          const featured = beat >= 5 && i === 0;
          return (
            <motion.div
              key={agent}
              className={`relative flex flex-col rounded-[1.3vmin] border bg-[#fbfcf8] p-[1.65vmin] shadow-[0_1.1vmin_3vmin_rgba(26,39,68,.08)] ${i < 3 ? 'col-span-2' : 'col-span-3'} ${featured ? 'z-20 border-[#0d9488] ring-[0.35vmin] ring-[#0d9488]/20' : 'border-[#d5e0e0]'}`}
              initial={{ opacity: 0.24, y: 8, scale: 0.98 }}
              animate={{ opacity: beat >= 2 ? 1 : 0.24, y: beat >= 2 ? 0 : 8, scale: featured ? 1.04 : 1 }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[1.8vmin] font-semibold text-[#263c4c]">{agent}</h3>
                <Tag tone={done ? 'teal' : 'slate'}>{done ? 'DONE' : beat >= 3 ? 'RUNNING' : 'READY'}</Tag>
              </div>
              <motion.div className="mt-[1.3vmin] h-[0.42vmin] overflow-hidden rounded-full bg-[#e5ebea]" animate={{ opacity: beat >= 3 ? 1 : 0 }}>
                <motion.div className="h-full rounded-full bg-[#0d9488]" initial={{ width: '0%' }} animate={{ width: done ? '100%' : beat >= 3 ? `${38 + i * 8}%` : '0%' }} transition={{ duration: done ? 0.55 : 0.3, delay: i * 0.07 }} />
              </motion.div>
              <motion.p className="mt-auto pt-[1.3vmin] font-mono text-[1vmin] text-[#8a9898]" animate={{ opacity: beat >= 3 ? 1 : 0 }}>
                {done ? 'Completed response' : beat >= 3 ? 'Analysis in progress' : 'Waiting to run'}
              </motion.p>
            </motion.div>
          );
        })}
      </div>
      <motion.div
        className="absolute bottom-[11%] left-[6%] z-30 rounded-[1.25vmin] border border-[#c9d9d6] bg-[#f9fbf7] px-[1.6vmin] py-[1.1vmin] font-mono text-[1.2vmin] text-[#45616a]"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: beat >= 6 ? 1 : 0, x: beat >= 6 ? 0 : -10 }}
      >
        Wait for the card you need to show <b className="text-[#0d766e]">Done</b>.
      </motion.div>
      <motion.div
        className="absolute bottom-[10%] right-[6%] z-30 w-[40%] rounded-[1.3vmin] border border-[#98cbc5] bg-white px-[1.7vmin] py-[1.4vmin] shadow-lg"
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: beat >= 6 ? 1 : 0, scale: beat >= 6 ? 1 : 0.9, y: beat >= 6 ? 0 : 15 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <span className="font-mono text-[0.98vmin] font-bold tracking-[0.1em] text-[#0d9488]">ASK ONE NARROW FOLLOW-UP</span>
        <p className="mt-[0.8vmin] font-display text-[1.65vmin] text-[#334a58]">“Which point should I verify first?”</p>
        <motion.div className="mt-[0.75vmin] border-t border-[#e3e9e7] pt-[0.65vmin] font-mono text-[1vmin] text-[#718186]" animate={{ opacity: beat >= 7 ? 1 : 0 }}>
          Direct answer on this card
        </motion.div>
      </motion.div>
      <motion.div className="absolute right-[5%] top-1/2 z-30 h-[2.2vmin] w-[2.2vmin] rounded-full border-[0.3vmin] border-[#f59e0b]" animate={beat >= 8 ? { x: '18vw', opacity: [1, 0] } : { opacity: 0 }} transition={{ duration: 0.5 }} />
      <Disclosure />
    </motion.section>
  );
}
