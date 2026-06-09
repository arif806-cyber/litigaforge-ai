import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-20"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a2744] via-[#0f172a] to-[#0f172a]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />
      
      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="w-[6vw] h-[6vw] mb-8 mx-auto border-2 border-[#fbbf24] rounded-xl rotate-45 flex items-center justify-center bg-[#1a2744]/50 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            <div className="w-[3vw] h-[3vw] border border-[#fbbf24] rounded-lg -rotate-45" />
          </div>
          
          <h1 className="text-[7vw] font-bold font-display tracking-tight text-white mb-4">
            LitigaForge <span className="text-[#fbbf24]">AI</span>
          </h1>
        </motion.div>
        
        <motion.p 
          className="text-[2.2vw] text-white/70 max-w-[60vw]"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          Justice, powered by Intelligence. <br/>
          <span className="text-[1.5vw] font-mono mt-4 block text-[#f59e0b]">For Telangana & Andhra Pradesh</span>
        </motion.p>
        
        {phase >= 3 && (
          <motion.div 
            className="mt-16 flex gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {['Free Tier', 'Professional ₹999', 'Advocate Pro ₹2,499'].map((tier, i) => (
              <motion.div 
                key={i}
                className="px-6 py-2 border border-white/20 rounded-full text-[1.2vw] font-mono text-white/60 bg-white/5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                {tier}
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}