import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 6000),
      setTimeout(() => setPhase(5), 9000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const agents = [
    { name: "Claude Sonnet", focus: "Legal Precedents", color: "#8b5cf6" },
    { name: "Gemini Flash", focus: "Procedural Strategy", color: "#10b981" },
    { name: "GPT-5 Omni", focus: "Risk Analysis", color: "#f59e0b" }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d9488] z-20 text-white"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.div 
        className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.h2 
        className="text-[4vw] font-display font-bold mb-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      >
        Forge Workspace
      </motion.h2>
      
      <motion.p 
        className="text-[1.5vw] font-mono text-white/80 mb-16 relative z-10"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.3 }}
      >
        Parallel Multi-Agent Strategy Synthesis
      </motion.p>

      <div className="flex gap-12 relative z-10">
        {agents.map((agent, i) => (
          <motion.div 
            key={i}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 w-[20vw] flex flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: i * 0.4 }}
          >
            <motion.div 
              className="w-16 h-16 rounded-full mb-6 flex items-center justify-center text-2xl font-bold"
              style={{ backgroundColor: agent.color }}
              animate={phase >= 4 ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              A{i+1}
            </motion.div>
            
            <h3 className="text-[1.5vw] font-display font-bold mb-2 text-center">{agent.name}</h3>
            <p className="text-[1vw] font-mono text-white/70 text-center uppercase tracking-wider">{agent.focus}</p>
            
            <motion.div 
              className="mt-6 w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: i * 0.4 + 0.5 }}
            >
              {[1, 2, 3].map(bar => (
                <div key={bar} className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-white/60 rounded-full"
                    initial={{ width: 0 }}
                    animate={phase >= 4 ? { width: `${Math.random() * 60 + 40}%` } : { width: 0 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                </div>
              ))}
            </motion.div>
          </motion.div>
        ))}
      </div>
      
      {/* Visual connection lines to a central point */}
      {phase >= 5 && (
        <motion.div 
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
           <p className="text-[1.2vw] font-mono mb-4 text-white/80">Synthesizing...</p>
           <motion.div 
             className="w-24 h-1 bg-white/40 rounded-full overflow-hidden"
           >
             <motion.div className="h-full bg-white" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1, repeat: Infinity }} />
           </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
