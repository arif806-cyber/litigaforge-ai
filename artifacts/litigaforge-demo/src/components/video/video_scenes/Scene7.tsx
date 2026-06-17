import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  "Dashboard",
  "Match & Connect",
  "Forge Workspace",
  "Legal Q&A",
  "Judgment Finder",
  "Document Analyzer",
  "Templates",
  "Legal Aid"
];

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000), // Legal Q&A
      setTimeout(() => setPhase(3), 4000), // Judgment Finder
      setTimeout(() => setPhase(4), 6000), // Document Analyzer
      setTimeout(() => setPhase(5), 8000), // Templates
      setTimeout(() => setPhase(6), 10000), // Legal Aid
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const features = [
    { title: "Legal Q&A", desc: "Instant AI answers for everyday legal doubts.", nav: "Legal Q&A" },
    { title: "Judgment Finder", desc: "Search the Global Case Law Database.", nav: "Judgment Finder" },
    { title: "Document Analyzer", desc: "Risk scoring & missing clauses detection.", nav: "Document Analyzer" },
    { title: "Free Templates", desc: "10+ types of ready-to-use legal documents.", nav: "Templates" },
    { title: "Legal Aid Finder", desc: "Locate Free legal aid & resources quickly.", nav: "Legal Aid" },
  ];

  const getActiveNav = () => {
    if (phase >= 6) return "Legal Aid";
    if (phase >= 5) return "Templates";
    if (phase >= 4) return "Document Analyzer";
    if (phase >= 3) return "Judgment Finder";
    if (phase >= 2) return "Legal Q&A";
    return "";
  };

  const activeNav = getActiveNav();

  return (
    <motion.div 
      className="absolute inset-0 flex bg-[#f8fafc] z-10 overflow-hidden"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 1 }}
    >
      {/* Nav Rail */}
      <motion.div 
        className="w-[25vw] h-full bg-[#1a2744] flex flex-col px-8 py-12 z-30 shadow-2xl relative"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
          </div>
          <span className="text-[1.5vw] font-display font-bold text-white">LitigaForge</span>
        </div>
        <div className="flex flex-col gap-3">
          {NAV_ITEMS.map((item) => (
            <motion.div
              key={item}
              className={`px-6 py-4 rounded-xl text-[1.2vw] font-mono transition-colors duration-300 ${
                activeNav === item ? 'bg-[#0d9488] text-white font-bold shadow-lg shadow-[#0d9488]/30 scale-105' : 'text-white/50'
              }`}
            >
              {item}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-16 relative">
        <motion.h2 
          className="text-[4vw] font-display font-bold text-primary mb-12 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        >
          A Complete Legal Ecosystem
        </motion.h2>

        <div className="grid grid-cols-2 gap-6 w-full max-w-[50vw]">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              className={`bg-white rounded-2xl p-8 shadow-xl border border-primary/5 ${i === 4 ? 'col-span-2' : ''}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={phase >= (i+2) ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 150, damping: 20 }}
            >
              <h3 className="text-[1.8vw] font-bold font-display text-primary mb-3">{feat.title}</h3>
              <p className="text-[1.1vw] text-secondary font-mono leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
