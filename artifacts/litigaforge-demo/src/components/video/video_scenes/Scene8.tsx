import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene8() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-primary text-white z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5 }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at center, var(--color-accent) 0%, transparent 60%)',
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.h1 
        className="text-[6vw] font-black font-display tracking-tight text-white mb-6 relative z-10"
        initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
        animate={phase >= 1 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 40, filter: 'blur(10px)' }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        Justice, Accelerated.
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.8 }}
        className="flex items-center gap-4 mb-12 relative z-10"
      >
        <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
           <div className="w-6 h-6 bg-primary rotate-45" />
        </div>
        <span className="text-[3vw] font-bold font-display text-white">LitigaForge AI</span>
      </motion.div>

      <motion.p
        className="text-[2vw] font-mono text-accent tracking-widest relative z-10 border-t border-white/20 pt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8 }}
      >
        LITIGAFORGE.COM
      </motion.p>
    </motion.div>
  );
}
