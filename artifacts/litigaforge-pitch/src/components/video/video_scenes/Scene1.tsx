import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="text-center relative z-10"
        animate={{ y: phase >= 2 ? -50 : 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.p 
          className="text-[2vw] font-mono text-[#f59e0b] tracking-widest uppercase mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        >
          The Problem
        </motion.p>
        
        <h1 className="text-[6vw] font-bold leading-tight font-display tracking-tight">
          <motion.span 
            className="block"
            initial={{ opacity: 0, y: 40, rotateX: -20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 40, rotateX: -20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          >
            Access to Justice
          </motion.span>
          <motion.span 
            className="block text-white/50"
            initial={{ opacity: 0, y: 40, rotateX: -20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 40, rotateX: -20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.4 }}
          >
            is Broken.
          </motion.span>
        </h1>
      </motion.div>

      <div className="flex gap-[4vw] mt-12 relative z-10">
        {[
          { stat: '50M+', label: 'Pending Cases in India' },
          { stat: '80%', label: 'Fail to Find Right Counsel' },
        ].map((item, i) => (
          <motion.div 
            key={i}
            className="bg-[#1a2744]/50 border border-white/10 p-8 rounded-2xl backdrop-blur-md w-[25vw]"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: i * 0.2 }}
          >
            <div className="text-[4vw] font-bold text-[#fbbf24] leading-none mb-2">{item.stat}</div>
            <div className="text-[1.5vw] text-white/70">{item.label}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}