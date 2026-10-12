import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Disclosure, EASE, StepTitle, Tag } from '../TutorialUI';

export function Scene6() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 350, callback: () => setBeat(1) },
    { time: 1300, callback: () => setBeat(2) },
    { time: 2400, callback: () => setBeat(3) },
    { time: 3300, callback: () => setBeat(4) },
    { time: 4700, callback: () => setBeat(5) },
    { time: 5700, callback: () => setBeat(6) },
    { time: 7600, callback: () => setBeat(7) },
    { time: 9000, callback: () => setBeat(8) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 z-10 overflow-hidden bg-[#1a2744] text-white"
      initial={{ opacity: 0, clipPath: 'inset(100% 0 0 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,.2) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.2) 1px,transparent 1px)', backgroundSize: '6vmin 6vmin' }} />
      <div className="absolute left-[5.5%] top-[8%] z-10">
        <StepTitle number="05 /" title="Pressure-test the theory" dark />
        <motion.div className="mt-[1.5vmin] flex gap-[1vmin]" animate={{ opacity: beat >= 1 ? 1 : 0 }}>
          <span className="rounded-lg border border-white/20 bg-white/8 px-[1.3vmin] py-[0.8vmin] font-mono text-[1.15vmin] text-white/75">Quick simulation</span>
          <span className="rounded-lg border border-white/20 bg-white/8 px-[1.3vmin] py-[0.8vmin] font-mono text-[1.15vmin] text-white/75">Custom simulation</span>
        </motion.div>
      </div>
      <motion.div
        className="absolute left-[5.5%] right-[5.5%] top-[31%] bottom-[14%] grid grid-cols-2 gap-[1.8vmin]"
        initial={{ opacity: 0.3, scale: 0.97 }}
        animate={{ opacity: beat >= 1 ? 1 : 0.3, scale: beat >= 1 ? 1 : 0.97 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="relative rounded-[1.5vmin] border border-white/16 bg-[#243653] p-[2.4vmin]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[1.1vmin] font-bold tracking-[0.18em] text-white/50">BEFORE</span>
            <span className="h-[1vmin] w-[1vmin] rounded-full bg-[#9daab4]" />
          </div>
          <div className="mt-[3vmin] flex items-start gap-[1.3vmin]">
            <div className="mt-[0.3vmin] h-[1.2vmin] w-[1.2vmin] shrink-0 rounded-sm border border-[#6a8194]" />
            <div>
              <span className="font-mono text-[1vmin] tracking-[0.1em] text-white/40">ISSUE NODE</span>
              <p className="mt-[0.7vmin] font-display text-[2vmin] text-white/78">Current matter map</p>
            </div>
          </div>
          <motion.div className="mt-[2.3vmin] h-[0.72vmin] w-[57%] rounded-full bg-white/12" animate={{ opacity: beat >= 3 ? 1 : 0 }} />
          <motion.div className="absolute bottom-[2.3vmin] left-[2.4vmin] font-mono text-[1.1vmin] text-white/45" animate={{ opacity: beat >= 4 ? 1 : 0 }}>Live matter baseline</motion.div>
        </div>
        <div className="relative rounded-[1.5vmin] border border-[#9c7b38]/55 bg-[#302f35] p-[2.4vmin]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[1.1vmin] font-bold tracking-[0.18em] text-[#f3cd75]">SCENARIO</span>
            <Tag tone="amber">WHAT IF</Tag>
          </div>
          <motion.p className="mt-[2.7vmin] max-w-[80%] font-display text-[2vmin] leading-snug text-white/90" animate={{ opacity: beat >= 2 ? 1 : 0 }}>
            What if this point were different?
          </motion.p>
          <motion.div className="mt-[2.5vmin] space-y-[1.25vmin]" animate={{ opacity: beat >= 3 ? 1 : 0 }}>
            <p className="mb-[0.3vmin] font-mono text-[1.02vmin] font-bold tracking-[0.12em] text-white/48">COMPARE DELTAS</p>
            <div className="flex items-center gap-[1vmin]">
              <span className="h-[1.1vmin] w-[1.1vmin] rounded-sm bg-[#f59e0b]" />
              <span className="font-mono text-[1.18vmin] text-white/78">Issue node: changed</span>
              <span className="ml-auto font-mono text-[1vmin] text-[#f6c55f]">DELTA</span>
            </div>
            <div className="flex items-center gap-[1vmin]">
              <span className="h-[1.1vmin] w-[1.1vmin] rounded-sm bg-[#0d9488]" />
              <span className="font-mono text-[1.18vmin] text-white/66">Related node: unchanged</span>
              <span className="ml-auto font-mono text-[1vmin] text-[#62c4b7]">—</span>
            </div>
          </motion.div>
          <motion.div className="absolute bottom-[2.3vmin] left-[2.4vmin]" animate={{ opacity: beat >= 5 ? 1 : 0 }}>
            <Tag tone="amber">SCENARIO ONLY</Tag>
          </motion.div>
        </div>
      </motion.div>
      <motion.div
        className="absolute bottom-[14%] left-[5.5%] right-[5.5%] flex items-center justify-between rounded-[1.2vmin] border border-[#e1bd67]/40 bg-[#302f35] px-[1.8vmin] py-[1.25vmin]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: beat >= 6 ? 1 : 0, y: beat >= 6 ? 0 : 12 }}
      >
        <p className="font-mono text-[1.18vmin] text-white/78">Apply scores only when you intend to update the live matter.</p>
        <span className="rounded-lg border border-[#f59e0b]/55 px-[1.2vmin] py-[0.6vmin] font-mono text-[1vmin] text-[#f5cd78]">APPLY · NOT PRESSED</span>
      </motion.div>
      <motion.div className="absolute left-[5.5%] top-[22%] h-px bg-[#0d9488]" animate={{ width: beat >= 8 ? '89%' : beat >= 7 ? '31%' : '0%' }} transition={{ duration: 0.7, ease: EASE }} />
      <Disclosure dark />
    </motion.section>
  );
}
