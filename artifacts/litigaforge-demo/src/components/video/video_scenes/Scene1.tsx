import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 7000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="w-32 h-32 mb-8 border-4 rounded-full flex items-center justify-center"
          style={{ borderColor: 'var(--color-primary)' }}
        >
          <motion.div 
            className="w-16 h-16"
            style={{ backgroundColor: 'var(--color-accent)' }}
            animate={{ rotate: 180, borderRadius: ["20%", "50%", "20%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.h1 
          className="text-[6vw] font-bold font-display text-primary leading-none tracking-tight text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          LitigaForge AI
        </motion.h1>

        <motion.p 
          className="text-[2vw] text-secondary mt-6 font-medium tracking-wide uppercase"
          initial={{ opacity: 0, opacity: 0, filter: 'blur(5px)' }}
          animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(5px)' }}
          transition={{ duration: 1 }}
        >
          Legal Intelligence for Telangana & AP
        </motion.p>
      </div>
    </motion.div>
  );
}
