import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 7000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-16 z-10 bg-primary"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="w-[70vw] h-[70vh] bg-white rounded-3xl shadow-2xl p-10 flex flex-col relative overflow-hidden"
        initial={{ y: '20vh', opacity: 0 }}
        animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: '20vh', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        <div className="absolute top-0 left-0 w-full h-12 bg-secondary/10 flex items-center px-6 border-b border-secondary/20">
          <span className="text-secondary font-mono text-[1vw] font-bold tracking-widest uppercase">Unified Strategy Master Document</span>
        </div>

        <div className="mt-12 flex-1 flex gap-8">
          <div className="w-1/3 border-r border-primary/10 pr-8">
            <motion.h3 
              className="text-[1.8vw] font-display font-bold text-primary mb-6"
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            >
              Action Plan
            </motion.h3>
            <motion.ul className="space-y-4 font-mono text-[1vw] text-text-secondary">
              <motion.li initial={{ opacity: 0, x: -20 }} animate={phase >= 2 ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.1 }}>1. Send Legal Notice (Section 106 TPA)</motion.li>
              <motion.li initial={{ opacity: 0, x: -20 }} animate={phase >= 2 ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.3 }}>2. File Eviction Suit</motion.li>
              <motion.li initial={{ opacity: 0, x: -20 }} animate={phase >= 2 ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.5 }}>3. Claim Arrears with 18% Interest</motion.li>
            </motion.ul>
          </div>

          <div className="w-2/3 flex flex-col gap-6">
            <motion.div 
              className="bg-bg-muted p-6 rounded-xl border border-primary/5"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            >
              <h4 className="text-[1.2vw] font-bold text-primary mb-2">Key Precedent Identified</h4>
              <p className="text-[1vw] text-text-secondary italic">"Supreme Court ruling in X vs Y confirms landlord right to immediate possession upon non-payment."</p>
            </motion.div>

            <motion.div 
              className="bg-accent/10 p-6 rounded-xl border border-accent/20"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            >
              <h4 className="text-[1.2vw] font-bold text-accent mb-2">Risk Assessment</h4>
              <p className="text-[1vw] text-text-secondary">Tenant may claim oral agreement extension. Mitigate by relying strictly on registered lease deed clauses 4 and 7.</p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
