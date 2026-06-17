import { motion } from 'framer-motion';
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

const AGENTS = [
  { name: "Claude Sonnet 4", role: "Precedent Research", color: "#a855f7" },
  { name: "Gemini 2.5 Flash", role: "Procedural Strategy", color: "#10b981" },
  { name: "GPT-5 Omni", role: "Risk Analysis", color: "#f59e0b" },
];

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // Nav enters
      setTimeout(() => setPhase(2), 2000),  // Main header
      setTimeout(() => setPhase(3), 3500),  // Case card
      setTimeout(() => setPhase(4), 5000),  // Agents
      setTimeout(() => setPhase(5), 8500),  // Connection lines & Synthesis
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex bg-[#0a1628] z-20 text-white overflow-hidden"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Background grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff1a 1px, transparent 1px), linear-gradient(to bottom, #ffffff1a 1px, transparent 1px)`,
          backgroundSize: '4vw 4vw'
        }}
      />
      {/* Constellation particles (simplified as CSS animated divs) */}
      {[...Array(15)].map((_, i) => (
        <motion.div 
          key={`star-${i}`}
          className="absolute w-1 h-1 bg-white rounded-full opacity-50 blur-[1px]"
          style={{
            top: `${10 + Math.random() * 80}%`,
            left: `${20 + Math.random() * 80}%`,
          }}
          animate={{ scale: [1, 2, 1], opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Nav Rail */}
      <motion.div 
        className="w-[20vw] h-full bg-[#1a2744] border-r border-white/10 flex flex-col px-6 py-12 z-30"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
          </div>
          <span className="text-[1.2vw] font-display font-bold">LitigaForge</span>
        </div>
        <div className="flex flex-col gap-2">
          {NAV_ITEMS.map((item, i) => (
            <motion.div
              key={item}
              className={`px-4 py-3 rounded-xl text-[1vw] font-mono ${item === "Forge Workspace" ? 'bg-[#0d9488] text-white font-bold' : 'text-white/60'}`}
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              {item}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 p-12 relative flex flex-col z-20">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        >
          <h1 className="text-[4vw] font-display font-bold text-[#0d9488] leading-none mb-2">
            FORGE WORKSPACE
          </h1>
          <p className="text-[1.2vw] font-mono text-white/60 tracking-wider">
            Multi-Agent Legal Intelligence • Claude + Gemini + GPT-5
          </p>
        </motion.div>

        <motion.div
          className="mt-12 bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md self-start"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', bounce: 0.4 }}
        >
          <div className="flex items-center gap-4 mb-2">
            <span className="text-[1.2vw] font-display font-bold text-white">Property Dispute — Unauthorized Occupation</span>
            <motion.span 
              className="px-3 py-1 bg-accent/20 text-accent text-[0.8vw] font-mono rounded-full border border-accent/30"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ANALYZING...
            </motion.span>
          </div>
        </motion.div>

        <div className="flex-1 mt-12 flex items-center justify-between gap-8 relative">
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.name}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm"
              initial={{ opacity: 0, y: 40 }}
              animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              transition={{ duration: 0.6, delay: i * 0.3 }}
            >
              <motion.div 
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${agent.color}, transparent 70%)` }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 4, repeat: Infinity, delay: i }}
              />
              
              <div className="flex flex-col items-center relative z-10">
                <div 
                  className="w-16 h-16 rounded-full mb-4 flex items-center justify-center border-2"
                  style={{ borderColor: agent.color, boxShadow: `0 0 20px ${agent.color}40` }}
                >
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: agent.color }} />
                </div>
                <h3 className="text-[1.2vw] font-display font-bold mb-1">{agent.name}</h3>
                <p className="text-[0.9vw] font-mono mb-6" style={{ color: agent.color }}>{agent.role}</p>
                
                <div className="w-full bg-black/40 p-4 rounded-xl font-mono text-[0.85vw] text-white/70 h-24 overflow-hidden border border-white/5">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ delay: i * 0.3 + 0.5 }}
                  >
                    <TypingText text={`Initializing agent protocol...\nLoading case context...\nQuerying domain knowledge...`} />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Connection Lines */}
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[2px] z-0"
            initial={{ opacity: 0 }}
            animate={phase >= 5 ? { opacity: 1 } : { opacity: 0 }}
          >
            <svg className="w-full h-full overflow-visible" style={{ position: 'absolute' }}>
               <motion.path 
                 d="M 16.6% 0 Q 50% 100 50% 100 T 83.3% 0" 
                 fill="none" 
                 stroke="url(#gradient)" 
                 strokeWidth="2"
                 initial={{ pathLength: 0 }}
                 animate={{ pathLength: 1 }}
                 transition={{ duration: 1.5, ease: "easeInOut" }}
               />
               <defs>
                 <linearGradient id="gradient">
                   <stop offset="0%" stopColor="#a855f7" />
                   <stop offset="50%" stopColor="#0d9488" />
                   <stop offset="100%" stopColor="#f59e0b" />
                 </linearGradient>
               </defs>
            </svg>
            <motion.div 
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#0d9488]/20 rounded-full blur-xl"
              animate={{ scale: [1, 2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function TypingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return <span className="whitespace-pre-line">{displayed}</span>;
}
