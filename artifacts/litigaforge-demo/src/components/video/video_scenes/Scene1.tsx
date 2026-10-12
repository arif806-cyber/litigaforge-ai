import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Disclosure, EASE } from '../TutorialUI';

const STEPS = ['OPEN', 'MAP', 'ANALYZE', 'VERIFY', 'TEST', 'SAVE'];

export function Scene1() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 600, callback: () => setBeat(1) },
    { time: 1300, callback: () => setBeat(2) },
    { time: 2500, callback: () => setBeat(3) },
    { time: 4300, callback: () => setBeat(4) },
    { time: 5200, callback: () => setBeat(5) },
  ]);

  return (
    <motion.section
      className="absolute inset-0 z-10 overflow-hidden bg-[#1a2744] text-white"
      initial={{ opacity: 0, scale: 1.025 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px)', backgroundSize: '6vmin 6vmin' }} />
      <motion.div
        className="absolute -right-[14vmin] -top-[19vmin] h-[74vmin] w-[74vmin] rounded-full border-[1.5vmin] border-[#0d9488]/60"
        initial={{ scale: 1.5, opacity: 0.1 }}
        animate={{ scale: beat >= 2 ? [1.08, 0.98] : 1.08, opacity: 0.7 }}
        transition={{ duration: 1.5, ease: EASE }}
      />
      <motion.div
        className="absolute right-[5.5%] top-[16%] h-[68%] w-[46%] rounded-[2vmin] border border-white/20 bg-[#f6f7f0] shadow-2xl"
        initial={{ opacity: 0.42, y: 12, rotate: 1 }}
        animate={{ opacity: beat >= 1 ? 1 : 0.42, y: beat >= 1 ? 0 : 12, rotate: 0 }}
        transition={{ duration: 0.75, ease: EASE }}
      >
        <div className="flex h-[13%] items-center gap-[1.1vmin] border-b border-[#d6dfdf] px-[2vmin]">
          <span className="font-display text-[1.55vmin] font-bold text-[#1a2744]">LitigaForge</span>
          <span className="h-[1.6vmin] w-px bg-[#bbc9cc]" />
          <span className="font-mono text-[1.2vmin] text-[#556a75]">Forge Workspace</span>
        </div>
        <div className="flex h-[87%] items-center justify-center">
          <div className="w-[74%] space-y-[1.6vmin]">
            <div className="h-[1vmin] w-[28%] rounded-full bg-[#0d9488]/70" />
            <div className="h-[2.3vmin] w-[70%] rounded bg-[#1a2744]/15" />
            <div className="h-[1.4vmin] w-full rounded bg-[#1a2744]/8" />
            <div className="h-[1.4vmin] w-[82%] rounded bg-[#1a2744]/8" />
            <div className="grid grid-cols-2 gap-[1vmin] pt-[1.4vmin]">
              <div className="h-[10vmin] rounded-xl border border-[#cad8d9] bg-white" />
              <div className="h-[10vmin] rounded-xl border border-[#cad8d9] bg-white" />
            </div>
          </div>
        </div>
      </motion.div>
      <div className="absolute left-[7%] top-[19%] z-10 max-w-[48%]">
        <motion.div
          className="mb-[2.3vmin] font-mono text-[1.55vmin] font-bold tracking-[0.22em] text-[#65c9bb]"
          initial={{ opacity: 1, x: 0 }}
          animate={{ opacity: 1, x: 0 }}
        >
          LITIGAFORGE
        </motion.div>
        <motion.h1
          className="font-display text-[6.3vmin] font-semibold leading-[0.98] tracking-[-0.06em]"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
        >
          FORGE
          <br />
          WORKSPACE
        </motion.h1>
        <motion.p
          className="mt-[2.5vmin] max-w-[41vmin] font-display text-[2.4vmin] leading-snug text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: beat >= 2 ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          A matter <span className="text-[#f59e0b]">→</span> a map <span className="text-[#f59e0b]">→</span> a checked next step.
        </motion.p>
        <motion.div
          className="mt-[4vmin] flex flex-wrap gap-x-[1.35vmin] gap-y-[1.1vmin]"
          animate={{ opacity: beat >= 3 ? 1 : 0, y: beat >= 3 ? 0 : 8 }}
          transition={{ duration: 0.4 }}
        >
          {STEPS.map((step, i) => (
            <span key={step} className={`font-mono text-[1.35vmin] tracking-[0.1em] ${beat >= 4 && i === 0 ? 'text-[#f59e0b]' : 'text-white/65'}`}>
              {step}{i < STEPS.length - 1 ? <span className="ml-[1.35vmin] text-white/25">/</span> : ''}
            </span>
          ))}
        </motion.div>
      </div>
      <motion.div
        className="absolute right-[49%] top-[51%] z-20 h-[2.2vmin] w-[2.2vmin] rounded-full border-[0.3vmin] border-[#f59e0b]"
        animate={beat >= 5 ? { x: '40vw', y: '-20vh', scale: 3.2, opacity: [1, 1, 0] } : { x: beat >= 4 ? 24 : 0 }}
        transition={{ duration: 0.72, ease: [0.65, 0, 0.35, 1] }}
      />
      <Disclosure dark />
    </motion.section>
  );
}
