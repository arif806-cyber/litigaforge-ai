import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  "Dashboard",
  "Match & Connect",
  "Forge Workspace",
  "Legal Q&A",
  "Judgment Finder",
  "Document Analyzer",
  "Templates",
  "Legal Aid"
];

export function Scene6() {
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 5000),
      setTimeout(() => setPhase(4), 8000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex bg-[#0a1628] z-20 text-white overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 1 }}
    >
      {/* Background Grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff1a 1px, transparent 1px), linear-gradient(to bottom, #ffffff1a 1px, transparent 1px)`,
          backgroundSize: '4vw 4vw'
        }}
      />

      {/* Sidebar (Static to match Scene 5) */}
      <div className="w-[20vw] h-full bg-[#1a2744] border-r border-white/10 flex flex-col px-6 py-12 z-30">
        <div className="mb-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
          </div>
          <span className="text-[1.2vw] font-display font-bold">LitigaForge</span>
        </div>
        <div className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <div
              key={item}
              className={`px-4 py-3 rounded-xl text-[1vw] font-mono ${item === "Forge Workspace" ? 'bg-[#0d9488] text-white font-bold' : 'text-white/60'}`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
        
        {/* Workspace Header */}
        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="text-[1.5vw] font-display font-bold text-white">Property Dispute</span>
            <span className="px-3 py-1 bg-secondary/20 text-secondary text-[0.8vw] font-mono rounded-full border border-secondary/30">
              ACTIVE
            </span>
          </div>
          <div className="text-[1vw] font-mono text-white/50">
            Advocate saved 14.3 hours on this case
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 relative overflow-hidden bg-black/20">
          <AnimatePresence mode="popLayout" initial={false}>
            {phase === 1 && (
              <PanelWrapper key="p1">
                <h2 className="text-[2.5vw] font-display font-bold text-[#0d9488] mb-6">Strategy Synthesis</h2>
                <div className="space-y-6">
                  <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-[1.2vw] font-bold mb-2">1. Notice to Quit</h3>
                    <p className="text-[1vw] text-white/70 font-mono">Drafting Section 106 – Notice to Quit. Asserting termination of month-to-month tenancy.</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-[1.2vw] font-bold mb-2">2. Eviction Suit</h3>
                    <p className="text-[1vw] text-white/70 font-mono">Preparing suit for possession and mesne profits.</p>
                  </div>
                  <div className="mt-8">
                    <p className="text-[0.9vw] font-mono text-white/50 mb-2">Confidence Score</p>
                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-secondary" initial={{ width: 0 }} animate={{ width: '92%' }} transition={{ duration: 1 }} />
                    </div>
                  </div>
                </div>
              </PanelWrapper>
            )}
            {phase === 2 && (
              <PanelWrapper key="p2">
                <h2 className="text-[2.5vw] font-display font-bold text-[#a855f7] mb-6">Instant Precedent Brief</h2>
                <div className="space-y-4 font-mono">
                  <motion.div className="p-4 border-l-4 border-[#a855f7] bg-[#a855f7]/10" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <p className="text-[1.1vw] font-bold">Supreme Court | 2021</p>
                    <p className="text-[0.9vw] text-white/70">"A tenant holding over is liable to pay mesne profits at market rate..."</p>
                  </motion.div>
                  <motion.div className="p-4 border-l-4 border-[#a855f7] bg-[#a855f7]/10" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                    <p className="text-[1.1vw] font-bold">High Court | 2019</p>
                    <p className="text-[0.9vw] text-white/70">"Notice under Section 106 must clearly grant 15 days time..."</p>
                  </motion.div>
                  <motion.div className="p-4 border-l-4 border-[#a855f7] bg-[#a855f7]/10" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                    <p className="text-[1.1vw] font-bold">Supreme Court | 2015</p>
                    <p className="text-[0.9vw] text-white/70">"Landlord's bona fide need is a subjective determination..."</p>
                  </motion.div>
                </div>
              </PanelWrapper>
            )}
            {phase === 3 && (
              <PanelWrapper key="p3">
                <h2 className="text-[2.5vw] font-display font-bold text-[#f59e0b] mb-6">Hearing Prep Pack</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-[1.2vw] font-bold text-white mb-4">Required Exhibits</h3>
                    <ul className="space-y-3 text-[1vw] text-white/70 font-mono">
                      <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-secondary" /> Original Lease Deed</li>
                      <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-secondary" /> Bank Statements (6 mo)</li>
                      <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-secondary" /> Legal Notice Copy</li>
                      <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-secondary" /> Postal Receipts</li>
                    </ul>
                  </div>
                  <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-[1.2vw] font-bold text-white mb-4">Witness Outline</h3>
                    <ul className="space-y-3 text-[1vw] text-white/70 font-mono">
                      <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-accent" /> Plaintiff (Landlord)</li>
                      <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-accent" /> Bank Manager</li>
                    </ul>
                  </div>
                </div>
              </PanelWrapper>
            )}
            {phase === 4 && (
              <PanelWrapper key="p4">
                <h2 className="text-[2.5vw] font-display font-bold text-white mb-6">Client Draft Memo</h2>
                <div className="bg-white text-black p-8 rounded-xl shadow-2xl relative overflow-hidden h-full">
                  <div className="absolute top-0 left-0 w-full h-2 bg-secondary" />
                  <p className="text-[1vw] font-mono text-gray-500 mb-6">CONFIDENTIAL & PRIVILEGED</p>
                  <p className="text-[1.1vw] leading-relaxed font-serif">
                    Dear Client,<br/><br/>
                    Based on our review of your property dispute, we have finalized the strategy to initiate eviction proceedings. The enclosed notice under the applicable tenancy law has been drafted and is ready for your signature...
                  </p>
                </div>
              </PanelWrapper>
            )}
          </AnimatePresence>
        </div>

        {/* Tagline */}
        <motion.div 
          className="absolute bottom-8 right-8 text-[1.5vw] font-display font-bold text-white z-30"
          initial={{ opacity: 0 }}
          animate={phase === 4 ? { opacity: 1, scale: [1, 1.05, 1] } : { opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          The most powerful legal workspace ever built.
        </motion.div>

      </div>
    </motion.div>
  );
}

function PanelWrapper({ children, ...props }: { children: React.ReactNode, [key: string]: any }) {
  return (
    <motion.div
      {...props}
      className="absolute inset-0 p-12"
      initial={{ x: '100%', clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
      animate={{ x: 0, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ x: '-20%', opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
    >
      {children}
    </motion.div>
  );
}
