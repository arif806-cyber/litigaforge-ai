import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Disclosure, EASE, StepTitle, Tag } from '../TutorialUI';

export function Scene3() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 400, callback: () => setBeat(1) },
    { time: 1200, callback: () => setBeat(2) },
    { time: 2000, callback: () => setBeat(3) },
    { time: 3500, callback: () => setBeat(4) },
    { time: 4800, callback: () => setBeat(5) },
    { time: 5900, callback: () => setBeat(6) },
    { time: 8100, callback: () => setBeat(7) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 z-10 overflow-hidden bg-[#f7f4eb] text-[#1a2744]"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="absolute inset-0 opacity-[0.34]" style={{ backgroundImage: 'linear-gradient(#becbc7 1px,transparent 1px),linear-gradient(90deg,#becbc7 1px,transparent 1px)', backgroundSize: '4.4vmin 4.4vmin' }} />
      <div className="absolute left-[5.5%] top-[7%] z-10">
        <StepTitle number="02 /" title="Give the record a shape" />
        <motion.p className="mt-[1.2vmin] font-mono text-[1.35vmin] text-[#63747a]" animate={{ opacity: beat >= 1 ? 1 : 0 }}>Add one Fact and one Issue.</motion.p>
      </div>
      <div className="absolute left-[6%] right-[6%] top-[25%] bottom-[10%]">
        <motion.div
          className="absolute left-[8%] top-[15%] w-[31%] rounded-[1.6vmin] border border-[#bdd8d4] bg-[#fbfdf8] p-[2.6vmin] shadow-[0_1.8vmin_5vmin_rgba(26,39,68,.09)]"
          initial={{ opacity: 0.32, scale: 0.92, y: 6 }}
          animate={{ opacity: beat >= 1 ? 1 : 0.32, scale: beat >= 1 ? 1 : 0.92, y: beat >= 1 ? 0 : 6 }}
          transition={{ duration: 0.62, ease: EASE }}
        >
          <div className="flex items-center justify-between">
            <Tag>FACT</Tag>
            <span className="h-[2.2vmin] w-[1.8vmin] rounded-sm border border-[#91beba] bg-[#e6f4f1]" />
          </div>
          <p className="mt-[2vmin] font-display text-[2.1vmin] leading-snug text-[#304959]">A document is listed in the record.</p>
          <p className="mt-[2.2vmin] font-mono text-[1.04vmin] tracking-[0.12em] text-[#7a8b8d]">SOURCE · DEMO ITEM</p>
        </motion.div>
        <motion.div
          className="absolute right-[8%] top-[15%] w-[31%] rounded-[1.6vmin] border-[0.22vmin] border-dashed border-[#d9b668] bg-[#fffaf0] p-[2.6vmin]"
          initial={{ opacity: 0.22, scale: 0.92, y: 6 }}
          animate={{ opacity: beat >= 2 ? 1 : 0.22, scale: beat >= 2 ? 1 : 0.92, y: beat >= 2 ? 0 : 6 }}
          transition={{ duration: 0.62, ease: EASE }}
        >
          <Tag tone="amber">ISSUE</Tag>
          <p className="mt-[2vmin] font-display text-[2.1vmin] leading-snug text-[#4e4d42]">Does the record support the stated position?</p>
          <p className="mt-[2.2vmin] font-mono text-[1.04vmin] tracking-[0.12em] text-[#9c895e]">QUESTION · NOT A FINDING</p>
        </motion.div>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1000 390" preserveAspectRatio="none" aria-hidden="true">
          <motion.path d="M390 173 C455 173 505 173 610 173" fill="none" stroke="#0d9488" strokeWidth="3" strokeDasharray="500" initial={{ strokeDashoffset: 500, opacity: 0 }} animate={{ strokeDashoffset: beat >= 3 ? 0 : 500, opacity: beat >= 3 ? 1 : 0 }} transition={{ duration: 1.15, ease: EASE }} />
          <motion.circle cx="390" cy="173" r="7" fill="#0d9488" initial={{ scale: 0 }} animate={{ scale: beat >= 3 ? 1 : 0 }} transition={{ delay: 0.7, duration: 0.35 }} />
          <motion.circle cx="610" cy="173" r="7" fill="#0d9488" initial={{ scale: 0 }} animate={{ scale: beat >= 3 ? 1 : 0 }} transition={{ delay: 1.3, duration: 0.35 }} />
        </svg>
        <motion.div className="absolute left-1/2 top-[37%] -translate-x-1/2 rounded-full border border-[#9fd5cf] bg-[#eaf6f3] px-[1.4vmin] py-[0.65vmin] font-mono text-[1.15vmin] text-[#0b756d]" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: beat >= 4 ? 1 : 0, scale: beat >= 4 ? 1 : 0.8 }} transition={{ duration: 0.4 }}>
          informs
        </motion.div>
        <motion.div className="absolute bottom-[8%] left-[8%] font-mono text-[1.25vmin] text-[#697a7e]" animate={{ opacity: beat >= 5 ? 1 : 0, y: beat >= 5 ? 0 : 8 }}>
          Connect them with a labeled relationship.
        </motion.div>
        <motion.div className="absolute bottom-[8%] right-[8%] font-mono text-[1vmin] tracking-[0.08em] text-[#9b8c66]" animate={{ opacity: beat >= 5 ? 1 : 0 }}>
          EXAMPLE TEXT IS FICTIONAL
        </motion.div>
      </div>
      <motion.div className="absolute inset-y-0 left-[23.5%] z-30 w-[1px] bg-[#0d9488]" initial={{ scaleY: 0 }} animate={beat >= 7 ? { scaleY: 1, x: '45vw' } : { scaleY: 0 }} transition={{ duration: 0.65, ease: EASE }} />
      <Disclosure />
    </motion.section>
  );
}
