import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const lawyers = [
    { score: 89, name: "Adv. Sharma", exp: "15 yrs", reason: "Specializes in Transfer of Property Act. Won 42 eviction cases in Hyderabad." },
    { score: 76, name: "Adv. Reddy", exp: "8 yrs", reason: "High success rate in civil disputes. Fits within specified budget." },
    { score: 68, name: "Adv. Rao", exp: "12 yrs", reason: "Experienced mediator, could resolve without court proceedings." }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-16 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1 }}
    >
      <motion.h2 
        className="text-[3.5vw] font-display text-primary mb-16 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
      >
        AI Lawyer Matching
      </motion.h2>

      <div className="flex gap-8 w-full max-w-[80vw]">
        {lawyers.map((lawyer, i) => (
          <motion.div 
            key={i}
            className="flex-1 bg-white rounded-2xl shadow-xl p-8 border border-primary/10 relative overflow-hidden"
            initial={{ opacity: 0, y: 50 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.6, delay: i * 0.3, type: 'spring', bounce: 0.4 }}
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-accent" />
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[1.8vw] font-display font-bold text-primary">{lawyer.name}</h3>
                <p className="text-[1vw] text-secondary font-mono">{lawyer.exp} Experience</p>
              </div>
              <div className="w-[4vw] h-[4vw] rounded-full border-4 border-accent flex items-center justify-center text-[1.2vw] font-bold text-primary font-mono shadow-inner">
                {lawyer.score}
              </div>
            </div>

            <motion.div 
              className="bg-bg-muted p-4 rounded-xl mt-4"
              initial={{ opacity: 0, height: 0 }}
              animate={phase >= 3 ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.5, delay: i * 0.3 + 0.5 }}
            >
              <p className="text-[0.8vw] font-bold text-primary/60 uppercase mb-2">AI Match Reason</p>
              <p className="text-[1vw] text-text-secondary italic">"{lawyer.reason}"</p>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
