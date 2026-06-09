import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const ais = [
    { name: "GPT-4/5", role: "Case Strategy & Summaries", color: "from-green-500/20" },
    { name: "Claude 3.5", role: "Deep Document Analysis", color: "from-orange-500/20" },
    { name: "Gemini Pro", role: "Rapid Legal Q&A", color: "from-blue-500/20" },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-20"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="text-center mb-16 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
      >
        <div className="inline-block px-4 py-1 rounded-full bg-[#f59e0b]/20 text-[#fbbf24] font-mono text-[1.2vw] mb-4 border border-[#f59e0b]/30">
          Intelligent Legal Engine
        </div>
        <h1 className="text-[5vw] font-bold font-display leading-none">
          Multi-AI Strategy
        </h1>
      </motion.div>

      <div className="flex gap-[3vw] relative z-10 w-full max-w-[80vw] mx-auto">
        {ais.map((ai, i) => (
          <motion.div 
            key={i}
            className={`flex-1 relative overflow-hidden bg-[#1a2744]/60 border border-white/10 p-8 rounded-3xl backdrop-blur-md flex flex-col items-center justify-center aspect-square text-center`}
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 40 }}
            transition={{ type: 'spring', stiffness: 150, damping: 15, delay: i * 0.2 }}
          >
            <div className={`absolute inset-0 bg-gradient-to-b ${ai.color} to-transparent opacity-50`} />
            <motion.div 
              className="relative z-10 font-bold text-[2.5vw] font-display mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, delay: i, ease: "easeInOut" }}
            >
              {ai.name}
            </motion.div>
            <div className="relative z-10 font-mono text-[1.2vw] text-white/70">
              {ai.role}
            </div>
            
            {/* Connection lines when phase 3 */}
            {phase >= 3 && i < ais.length - 1 && (
              <motion.div 
                className="absolute top-1/2 -right-[1.5vw] w-[3vw] h-[2px] bg-[#fbbf24]/50 z-0"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                style={{ transformOrigin: "left" }}
                transition={{ duration: 0.5, delay: i * 0.3 }}
              />
            )}
          </motion.div>
        ))}
      </div>
      
      {/* Central synthetic brain concept */}
      {phase >= 3 && (
        <motion.div 
          className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        >
          <div className="w-[40vw] h-[40vw] border-[1px] border-[#fbbf24]/10 rounded-full flex items-center justify-center">
            <div className="w-[30vw] h-[30vw] border-[1px] border-[#fbbf24]/20 rounded-full flex items-center justify-center">
               <div className="w-[20vw] h-[20vw] border-[1px] border-[#fbbf24]/30 rounded-full" />
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}