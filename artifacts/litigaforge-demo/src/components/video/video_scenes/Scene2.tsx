import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSceneTimer } from '@/lib/video';
import { DemoWindow, Disclosure, EASE, StepTitle, Tag } from '../TutorialUI';

export function Scene2() {
  const [beat, setBeat] = useState(0);
  useSceneTimer([
    { time: 450, callback: () => setBeat(1) },
    { time: 1200, callback: () => setBeat(2) },
    { time: 2100, callback: () => setBeat(3) },
    { time: 3400, callback: () => setBeat(4) },
    { time: 4500, callback: () => setBeat(5) },
    { time: 6500, callback: () => setBeat(6) },
    { time: 8100, callback: () => setBeat(7) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 z-10 overflow-hidden bg-[#f1f3ed] text-[#1a2744]"
      initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
      exit={{ opacity: 0, scale: 1.035 }}
      transition={{ duration: 0.58, ease: EASE }}
    >
      <div className="absolute left-[5.5%] top-[9%]">
        <StepTitle number="01 /" title="Open with a matter" />
        <motion.p className="mt-[1.3vmin] font-mono text-[1.45vmin] text-[#687983]" animate={{ opacity: beat >= 2 ? 1 : 0 }}>
          Create or open a workspace.
        </motion.p>
      </div>
      <motion.div
        className="absolute left-[5.5%] top-[27%] h-[59%] w-[89%]"
        initial={{ opacity: 0.38, scale: 0.97, y: 8 }}
        animate={{ opacity: beat >= 1 ? 1 : 0.38, scale: beat >= 1 ? 1 : 0.97, y: beat >= 1 ? 0 : 8 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <DemoWindow className="h-full">
          <div className="flex h-[calc(100%-6.3vmin)]">
            <div className="w-[24%] border-r border-[#dbe2e4] bg-[#f5f7f2] p-[2vmin]">
              <p className="font-mono text-[1.08vmin] font-bold tracking-[0.14em] text-[#859297]">WORKSPACES</p>
              <motion.div className="mt-[2vmin] rounded-xl border border-[#b8d8d4] bg-[#e9f5f1] p-[1.5vmin]" animate={{ x: beat >= 1 ? 0 : -12 }}>
                <span className="block h-[1.2vmin] w-[65%] rounded bg-[#0d9488]/30" />
                <span className="mt-[1vmin] block h-[0.8vmin] w-[42%] rounded bg-[#1a2744]/12" />
              </motion.div>
              <div className="mt-[1.2vmin] h-[5vmin] rounded-xl border border-transparent p-[1.5vmin]">
                <span className="block h-[1vmin] w-[55%] rounded bg-[#1a2744]/10" />
                <span className="mt-[1vmin] block h-[0.7vmin] w-[38%] rounded bg-[#1a2744]/8" />
              </div>
            </div>
            <div className="flex-1 p-[3.2vmin]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[1.1vmin] tracking-[0.16em] text-[#0d9488]">MATTER TITLE</p>
                  <h2 className="mt-[0.7vmin] font-display text-[3.5vmin] font-semibold tracking-[-0.05em]">DEMO MATTER</h2>
                </div>
                <Tag>Workspace</Tag>
              </div>
              <motion.div
                className="mt-[2.3vmin] rounded-[1.3vmin] border border-[#d8e0df] bg-white p-[2.2vmin]"
                initial={{ opacity: 0, height: '8vmin' }}
                animate={{ opacity: beat >= 2 ? 1 : 0.25, height: beat >= 2 ? 'auto' : '8vmin' }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[1.18vmin] font-bold tracking-[0.12em] text-[#526777]">CASE DESCRIPTION</span>
                  <span className="font-mono text-[1vmin] text-[#0d9488]">REVIEW</span>
                </div>
                <p className="mt-[1.4vmin] max-w-[79%] font-display text-[2vmin] leading-[1.45] text-[#354b5a]">
                  Neutral demo context: review what is verified, then separate disputed points before analysis.
                </p>
                <div className="mt-[1.7vmin] flex gap-[1vmin]">
                  <motion.div animate={{ opacity: beat >= 4 ? 1 : 0, x: beat >= 4 ? 0 : -10 }}><Tag tone="teal">VERIFIED</Tag></motion.div>
                  <motion.div animate={{ opacity: beat >= 4 ? 1 : 0, x: beat >= 4 ? 0 : 10 }}><Tag tone="amber">DISPUTED</Tag></motion.div>
                </div>
              </motion.div>
              <motion.div
                className="mt-[1.7vmin] flex items-center gap-[1.2vmin] border-l-[0.42vmin] border-[#f59e0b] pl-[1.5vmin] font-mono text-[1.35vmin] text-[#64737b]"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: beat >= 5 ? 1 : 0, x: beat >= 5 ? 0 : -10 }}
              >
                Check the title and description before moving on.
              </motion.div>
            </div>
          </div>
        </DemoWindow>
        <motion.div className="absolute -bottom-[1.2vmin] left-[21%] h-[0.3vmin] bg-[#0d9488]" animate={{ width: beat >= 7 ? '80%' : beat >= 6 ? '18%' : '0%' }} transition={{ duration: 0.7, ease: EASE }} />
      </motion.div>
      <Disclosure />
    </motion.section>
  );
}
