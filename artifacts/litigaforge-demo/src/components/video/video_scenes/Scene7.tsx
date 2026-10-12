import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Disclosure, EASE, StepTitle, Tag } from '../TutorialUI';

export function Scene7() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 350, callback: () => setBeat(1) },
    { time: 1400, callback: () => setBeat(2) },
    { time: 2700, callback: () => setBeat(3) },
    { time: 4200, callback: () => setBeat(4) },
    { time: 5300, callback: () => setBeat(5) },
    { time: 6800, callback: () => setBeat(6) },
    { time: 8500, callback: () => setBeat(7) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 z-10 overflow-hidden bg-[#f3f2eb] text-[#1a2744]"
      initial={{ opacity: 0, scale: 1.035 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.58, ease: EASE }}
    >
      <div className="absolute left-[5.5%] top-[7%] z-10">
        <StepTitle number="06 /" title="Finish with control" />
        <motion.p className="mt-[1.2vmin] font-mono text-[1.12vmin] text-[#69797c]" animate={{ opacity: beat >= 1 ? 1 : 0 }}>Refresh Intel · inspect Twin privacy controls · save · verify any PDF</motion.p>
      </div>
      <div className="absolute left-[5.5%] right-[5.5%] top-[25%] bottom-[10%] flex gap-[1.5vmin]">
        <div className="flex w-[57%] flex-col gap-[1.1vmin]">
          <motion.div
            className="rounded-[1.4vmin] border border-[#cfdcda] bg-[#fbfcf8] p-[1.7vmin] shadow-sm"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: beat >= 1 ? 1 : 0, x: beat >= 1 ? 0 : -16 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[1.8vmin] font-semibold">Intel</h3>
              <span className="rounded-lg border border-[#9ecdc7] bg-[#eaf7f4] px-[1.1vmin] py-[0.6vmin] font-mono text-[1vmin] text-[#0d766e]">Refresh Intel</span>
            </div>
            <motion.div className="mt-[1.2vmin] flex gap-[0.8vmin]" animate={{ opacity: beat >= 2 ? 1 : 0 }}>
              <span className="h-[0.78vmin] w-[48%] rounded-full bg-[#dce7e4]" />
              <span className="h-[0.78vmin] w-[31%] rounded-full bg-[#e8e5db]" />
            </motion.div>
            <motion.p className="mt-[0.8vmin] font-mono text-[1.05vmin] text-[#6a797b]" animate={{ opacity: beat >= 2 ? 1 : 0 }}>Review suggestions before acting.</motion.p>
          </motion.div>
          <motion.div
            className="relative flex-1 rounded-[1.4vmin] border border-[#cfdcda] bg-[#fbfcf8] p-[1.7vmin] shadow-sm"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: beat >= 3 ? 1 : 0, x: beat >= 3 ? 0 : -16 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-[1.8vmin] font-semibold">Legal Twin</h3>
                <p className="mt-[0.4vmin] font-mono text-[0.98vmin] text-[#788789]">Learning controls</p>
              </div>
              <motion.div className="h-[2.7vmin] w-[5.2vmin] rounded-full border border-[#bacac8] bg-[#f2f5f1] p-[0.35vmin]" animate={{ opacity: beat >= 4 ? 1 : 0 }}>
                <span className="block h-full w-[1.9vmin] rounded-full bg-[#99a8a7]" />
              </motion.div>
            </div>
            <motion.div className="mt-[1.3vmin] flex items-center gap-[0.8vmin] font-mono text-[1.05vmin] text-[#657679]" animate={{ opacity: beat >= 4 ? 1 : 0 }}>
              <span className="h-[1.2vmin] w-[1.2vmin] rounded-full border border-[#0d9488]" />
              Check privacy controls before continuing.
            </motion.div>
            <div className="absolute bottom-[1.8vmin] left-[1.7vmin] font-mono text-[0.93vmin] tracking-[0.08em] text-[#9aa5a1]">NO DEFAULT STATE ASSERTED</div>
          </motion.div>
        </div>
        <div className="relative flex-1">
          <motion.div
            className="absolute inset-x-0 top-0 rounded-[1.4vmin] border border-[#d3dcd8] bg-white p-[1.6vmin] shadow-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: beat >= 5 ? 1 : 0, y: beat >= 5 ? 0 : -10 }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[1.15vmin] font-bold tracking-[0.1em] text-[#556a70]">SAVE</span>
              <Tag tone={beat >= 6 ? 'teal' : 'slate'}>{beat >= 6 ? 'WORKSPACE SAVED' : 'READY'}</Tag>
            </div>
            <motion.div className="mt-[1vmin] h-[0.8vmin] w-[82%] rounded-full bg-[#e5ebe7]" animate={{ scaleX: beat >= 6 ? 1 : 0.78, transformOrigin: 'left' }} />
          </motion.div>
          <motion.div
            className="absolute inset-x-[6%] bottom-0 top-[31%] overflow-hidden rounded-[1vmin] border border-[#cfd8d5] bg-white shadow-[0_1.4vmin_4vmin_rgba(26,39,68,.12)]"
            initial={{ opacity: 0, y: 26, rotate: 1.5 }}
            animate={{ opacity: beat >= 6 ? 1 : 0, y: beat >= 6 ? 0 : 26, rotate: 0 }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <div className="flex items-center justify-between border-b border-[#e2e7e4] px-[1.3vmin] py-[0.9vmin]">
              <span className="font-mono text-[0.95vmin] font-bold tracking-[0.09em] text-[#617276]">GENERATED PDF · DEMO</span>
              <span className="font-mono text-[0.9vmin] text-[#0d9488]">OPEN</span>
            </div>
            <div className="space-y-[0.9vmin] px-[1.4vmin] py-[1.4vmin]">
              {[86, 92, 70, 90, 80, 91, 65, 87].map((width, i) => (
                <div key={i} className="h-[0.58vmin] rounded-full bg-[#778684]/15" style={{ width: `${width}%` }} />
              ))}
            </div>
            <motion.div className="absolute left-[1.2vmin] right-[1.2vmin] top-[49%] h-[3.5vmin] border-y border-[#f0c65e]/70 bg-[#f8e7b8]/35" animate={{ y: beat >= 7 ? ['-2vmin', '2vmin', '-2vmin'] : 0 }} transition={{ duration: 1.2, repeat: beat >= 7 ? Infinity : 0, ease: 'easeInOut' }} />
          </motion.div>
          <motion.p className="absolute bottom-[1vmin] left-0 right-0 text-center font-mono text-[1.02vmin] text-[#526d72]" animate={{ opacity: beat >= 7 ? 1 : 0 }}>
            Open and verify the PDF before use.
          </motion.p>
        </div>
      </div>
      <Disclosure />
    </motion.section>
  );
}
