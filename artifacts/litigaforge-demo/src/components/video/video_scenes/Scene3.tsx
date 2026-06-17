import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-20 z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: '-10vh' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        className="text-[3vw] font-display text-primary mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      >
        Client Posts Case Securely
      </motion.h2>

      <motion.div 
        className="w-[50vw] bg-white rounded-3xl shadow-2xl p-10 border-t-4 border-accent relative"
        initial={{ opacity: 0, y: 40 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        <div className="flex justify-between items-center mb-6">
          <span className="bg-primary/10 text-primary px-4 py-1 rounded-full text-[1vw] font-bold tracking-widest font-mono">Property Dispute</span>
          <span className="text-secondary font-mono text-[1vw]">ID: ANONYMOUS-849</span>
        </div>
        
        <h3 className="text-[2.2vw] font-display font-bold text-primary leading-tight mb-4">
          Tenant Eviction, Hyderabad
        </h3>
        
        <p className="text-[1.2vw] text-text-secondary font-mono leading-relaxed mb-8 border-l-4 border-primary/20 pl-4">
          "Tenant refuses to vacate property after lease expiry. Non-payment of rent for 4 months. Need immediate legal action under Transfer of Property Act."
        </p>

        <motion.div 
          className="flex justify-between items-end border-t border-primary/10 pt-6 mt-6"
          initial={{ opacity: 0 }}
          animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
        >
          <div>
            <p className="text-[0.9vw] text-text-muted font-bold uppercase mb-1">Estimated Budget</p>
            <p className="text-[1.5vw] font-mono text-primary font-bold">₹50,000 – ₹1,00,000</p>
          </div>
          
          <motion.div 
            className="bg-primary text-white px-8 py-3 rounded-lg text-[1.2vw] font-bold"
            animate={phase >= 4 ? { scale: [1, 1.05, 1], backgroundColor: ['#1a2744', '#0d9488', '#1a2744'] } : {}}
            transition={{ duration: 0.5 }}
          >
            Post Case
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
