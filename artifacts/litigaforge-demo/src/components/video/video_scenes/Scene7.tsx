import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 6000),
      setTimeout(() => setPhase(5), 8000),
      setTimeout(() => setPhase(6), 10000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const features = [
    { title: "Legal Q&A", desc: "Instant AI answers for everyday legal doubts." },
    { title: "Judgment Finder", desc: "Search Indian case law via IndianKanoon API." },
    { title: "Document Analyzer", desc: "Risk scoring & missing clauses detection." },
    { title: "Free Templates", desc: "10+ types of ready-to-use legal documents." },
    { title: "Legal Aid Finder", desc: "Locate NALSA and free resources quickly." },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-20 z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 1 }}
    >
      <motion.h2 
        className="text-[3.5vw] font-display text-primary mb-16"
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
      >
        A Complete Legal Ecosystem
      </motion.h2>

      <div className="grid grid-cols-3 gap-6 w-full max-w-[80vw]">
        {features.map((feat, i) => (
          <motion.div
            key={i}
            className={`bg-white rounded-2xl p-8 shadow-lg border border-primary/5 ${i >= 3 ? 'col-span-1.5' : ''}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={phase >= (i+2) ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 150, damping: 20 }}
          >
            <h3 className="text-[1.8vw] font-bold font-display text-primary mb-3">{feat.title}</h3>
            <p className="text-[1vw] text-secondary font-mono leading-relaxed">{feat.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
