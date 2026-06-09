import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center p-20"
      initial={{ opacity: 0, clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
      animate={{ opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="w-[45%] pr-12 relative z-10 flex flex-col justify-center">
        <motion.p 
          className="text-[#f59e0b] font-mono text-[1.2vw] mb-4 uppercase tracking-widest"
          initial={{ opacity: 0, x: -20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
        >
          Comprehensive Tools
        </motion.p>
        
        <motion.h1 
          className="text-[4.5vw] font-bold font-display leading-[1.1] mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.2 }}
        >
          Document Analyzer <br/>
          <span className="text-white/50">&amp; Precedents</span>
        </motion.h1>

        <div className="space-y-6">
          {[
             { title: "Risk Scoring", desc: "Instantly identify missing clauses and red flags." },
             { title: "Judgment Finder", desc: "Surface relevant case precedents automatically." },
             { title: "Free Legal Aid", desc: "Direct access to NALSA/TSLSA helplines." }
          ].map((item, i) => (
            <motion.div 
              key={i}
              className="border-l-2 border-[#f59e0b]/50 pl-6"
              initial={{ opacity: 0, x: -30 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ delay: i * 0.2 }}
            >
              <h3 className="text-[1.8vw] font-bold text-white mb-1">{item.title}</h3>
              <p className="text-[1.2vw] text-white/60">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
      
      <div className="w-[55%] relative h-full flex items-center justify-center z-10">
        <motion.div 
          className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-white/20"
          initial={{ opacity: 0, y: 50, rotateX: 10, rotateY: -10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0, rotateY: 0 } : { opacity: 0, y: 50, rotateX: 10, rotateY: -10 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ perspective: 1000 }}
        >
          <img src={`${import.meta.env.BASE_URL}images/doc-analysis.png`} className="w-full h-full object-cover" alt="Document Analysis" />
          
          {phase >= 3 && (
            <motion.div 
              className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="bg-[#1a2744] p-8 rounded-xl border border-[#fbbf24]/30 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
                 <div className="text-[#f59e0b] font-mono text-[1.5vw] mb-2">Analysis Complete</div>
                 <div className="text-[3vw] font-bold text-white">Risk Score: 12%</div>
                 <div className="w-full h-2 bg-white/10 mt-4 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: '88%' }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                 </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}