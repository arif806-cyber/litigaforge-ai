import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { Disclosure, EASE, StepTitle, Tag } from '../TutorialUI';

export function Scene5() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 350, callback: () => setBeat(1) },
    { time: 1200, callback: () => setBeat(2) },
    { time: 2700, callback: () => setBeat(3) },
    { time: 4200, callback: () => setBeat(4) },
    { time: 5900, callback: () => setBeat(5) },
    { time: 7000, callback: () => setBeat(6) },
    { time: 8300, callback: () => setBeat(7) },
    { time: 9500, callback: () => setBeat(8) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 z-10 overflow-hidden bg-[#edf2f1] text-[#1a2744]"
      initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="absolute left-[5.5%] top-[7%] z-10">
        <StepTitle number="04 /" title="Search. Open the source. Check it." />
        <p className="mt-[1.1vmin] font-mono text-[1.05vmin] tracking-[0.06em] text-[#697b80]">RESULTS ARE RESEARCH LEADS · VERIFY THE ORIGINAL</p>
      </div>
      <div className="absolute left-[5.5%] right-[5.5%] top-[27%] bottom-[10%] flex gap-[1.4vmin]">
        <motion.div
          className="relative flex w-[42%] flex-col rounded-[1.4vmin] border border-[#d2dedd] bg-[#fbfcf8] p-[2vmin] shadow-[0_1.4vmin_4vmin_rgba(26,39,68,.09)]"
          animate={{ width: beat >= 4 ? '34%' : '42%' }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div className="flex gap-[0.8vmin]">
            <Tag>MANUAL SEARCH</Tag>
            <Tag tone="amber">SMART SEARCH</Tag>
          </div>
          <motion.div className="mt-[1.6vmin] rounded-lg border border-[#cbd8d9] bg-white px-[1.3vmin] py-[1.1vmin] font-mono text-[1.2vmin] text-[#7b8a8e]" animate={{ borderColor: beat >= 1 ? '#0d9488' : '#cbd8d9' }}>
            <span className="mr-[0.7vmin] text-[#0d9488]">⌕</span>Search a precise issue…
          </motion.div>
          <motion.p className="mt-[1vmin] font-mono text-[1.02vmin] leading-relaxed text-[#78878a]" animate={{ opacity: beat >= 1 ? 1 : 0 }}>
            Use an issue—or let Smart Search derive queries from the description and canvas.
          </motion.p>
          <div className="mt-[1.5vmin] flex-1 space-y-[1vmin]">
            {['Judgment result A', 'Judgment result B'].map((result, i) => (
              <motion.div
                key={result}
                className={`rounded-xl border px-[1.3vmin] py-[1.4vmin] ${beat >= 3 && i === 0 ? 'border-[#d8b66c] bg-[#fff9e9]' : 'border-[#e0e7e5] bg-white'}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: beat >= 2 ? 1 : 0, x: beat >= 2 ? 0 : -12 }}
                transition={{ delay: i * 0.16, duration: 0.35 }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-[1.45vmin] font-medium text-[#324957]">{result}</span>
                  {i === 0 && beat >= 3 && (
                    <span className="flex items-center gap-[0.8vmin]">
                      <span className="font-mono text-[1vmin] text-[#946100]">SELECTED</span>
                      <span className="rounded-md border border-[#d8b66c] px-[0.7vmin] py-[0.35vmin] font-mono text-[0.92vmin] text-[#8b650e]">Open source</span>
                    </span>
                  )}
                </div>
                <span className="mt-[0.6vmin] block h-[0.75vmin] w-[78%] rounded bg-[#1a2744]/8" />
                <span className="mt-[0.5vmin] block h-[0.65vmin] w-[48%] rounded bg-[#1a2744]/6" />
              </motion.div>
            ))}
          </div>
          <motion.div className="mt-[1vmin] font-mono text-[0.95vmin] text-[#728287]" animate={{ opacity: beat >= 2 ? 1 : 0 }}>Demo result labels only · no citation data</motion.div>
        </motion.div>
        <motion.div
          className="relative flex-1 overflow-hidden rounded-[1.4vmin] border border-[#cbd9d9] bg-[#fcfdf9] shadow-[0_1.4vmin_4vmin_rgba(26,39,68,.08)]"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: beat >= 4 ? 1 : 0, x: beat >= 4 ? 0 : 18 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="flex items-center justify-between border-b border-[#e0e7e5] px-[2vmin] py-[1.3vmin]">
            <span className="font-mono text-[1.1vmin] font-bold tracking-[0.14em] text-[#566c75]">SOURCE VIEW · DEMO RESULT</span>
            {beat >= 6 && <Tag tone="teal">CHECKED</Tag>}
          </div>
          <div className="mx-auto mt-[2vmin] w-[78%] rounded-lg border border-[#e0e5e2] bg-white px-[2.2vmin] py-[2vmin] shadow-sm">
            <div className="h-[1.3vmin] w-[55%] rounded bg-[#1a2744]/14" />
            <div className="mt-[1.7vmin] space-y-[1vmin]">
              {[92, 86, 70, 90, 76, 83].map((width, i) => (
                <motion.div key={i} className="h-[0.68vmin] rounded-full bg-[#6b7c80]/15" style={{ width: `${width}%` }} animate={{ backgroundColor: beat >= 5 && i === 2 ? '#f2d98c' : '#dce3e1' }} transition={{ duration: 0.35 }} />
              ))}
            </div>
            <motion.div className="mt-[1.6vmin] border-l-[0.35vmin] border-[#0d9488] pl-[1vmin] font-mono text-[1.05vmin] text-[#64767a]" animate={{ opacity: beat >= 5 ? 1 : 0 }}>
              Inspect the original source before adding.
            </motion.div>
          </div>
          <motion.div
            className="absolute bottom-[1.8vmin] right-[2vmin] rounded-lg border border-[#9dcfc9] bg-[#eaf7f4] px-[1.3vmin] py-[0.85vmin] font-mono text-[1.08vmin] text-[#0b746c]"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: beat >= 6 ? 1 : 0, scale: beat >= 6 ? 1 : 0.85 }}
          >
            + Add checked judgment
          </motion.div>
        </motion.div>
      </div>
      <motion.div
        className="absolute left-[18%] top-[63%] z-20 h-[11vmin] w-[23vmin] rounded-[1.3vmin] border border-[#8ec7c0] bg-[#f7fffc] px-[1.5vmin] py-[1vmin] shadow-lg"
        initial={{ opacity: 0, y: 20, rotate: -4 }}
        animate={beat >= 7 ? { opacity: 1, x: '31vw', y: '-3vh', rotate: 0, scale: 0.9 } : { opacity: 0, y: 20, rotate: -4 }}
        transition={{ duration: 0.85, ease: EASE }}
      >
        <Tag>JUDGMENT</Tag>
        <div className="mt-[0.8vmin] h-[0.9vmin] w-[75%] rounded bg-[#1a2744]/10" />
        <div className="mt-[0.65vmin] h-[0.7vmin] w-[52%] rounded bg-[#1a2744]/8" />
      </motion.div>
      <Disclosure />
    </motion.section>
  );
}
