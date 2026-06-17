import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const items = [
    "Fragmented Legal Landscape",
    "Client Confusion",
    "Scattered Resources",
    "Slow Processes"
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-row items-center justify-center p-24 z-10"
      initial={{ opacity: 0, x: '10vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-10vw' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 flex flex-col justify-center pr-16">
        <motion.h2 
          className="text-[4.5vw] font-bold font-display text-primary leading-tight mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          The Problem is Clear.
        </motion.h2>
        <motion.p
          className="text-[1.8vw] text-secondary/80 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          Navigating the legal system often feels like entering a labyrinth.
        </motion.p>
      </div>

      <div className="w-1/2 flex flex-col gap-6">
        {items.map((item, i) => (
          <motion.div
            key={item}
            className="bg-white p-6 rounded-2xl shadow-xl shadow-primary/5 border border-primary/10"
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.6, delay: i * 0.2, type: 'spring', stiffness: 200, damping: 20 }}
          >
            <p className="text-[1.5vw] font-medium text-primary font-display">{item}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
