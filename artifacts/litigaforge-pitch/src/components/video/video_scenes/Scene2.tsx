import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center p-20"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 pr-12 relative z-10">
        <motion.div
          initial={{ width: 0 }}
          animate={phase >= 1 ? { width: '100px' } : { width: 0 }}
          className="h-[2px] bg-[#f59e0b] mb-8"
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.h1 
          className="text-[5vw] font-bold font-display leading-[1.1] mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
        >
          AI-Powered <br/>
          <span className="text-[#fbbf24]">Matching</span>
        </motion.h1>
        
        <motion.p 
          className="text-[1.8vw] text-white/70 mb-10"
          initial={{ opacity: 0 }}
          animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.4 }}
        >
          Connecting clients in Telangana & AP with verified lawyers using 0-100 match scores based on jurisdiction, domain, and past success.
        </motion.p>
        
        <div className="flex flex-col gap-4">
          {['Domain Expertise Match', 'Jurisdiction Alignment', 'Success Rate Analysis'].map((text, i) => (
            <motion.div 
              key={i}
              className="flex items-center gap-4 bg-[#1a2744]/40 p-4 rounded-xl border border-white/5"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ delay: i * 0.15 }}
            >
              <div className="w-8 h-8 rounded-full bg-[#f59e0b]/20 flex items-center justify-center text-[#fbbf24]">✓</div>
              <span className="text-[1.2vw]">{text}</span>
            </motion.div>
          ))}
        </div>
      </div>
      
      <div className="w-1/2 relative h-full flex items-center justify-center z-10">
        <motion.div 
          className="relative w-full aspect-square rounded-full overflow-hidden border border-white/10"
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.8, rotate: -10 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <img src={`${import.meta.env.BASE_URL}images/ai-network.png`} className="w-full h-full object-cover" alt="AI Network" />
          <motion.div 
            className="absolute inset-0 bg-gradient-to-tr from-[#1a2744] via-transparent to-transparent mix-blend-multiply"
          />
        </motion.div>
        
        {/* Floating elements */}
        {phase >= 3 && (
          <>
            <motion.div 
              className="absolute top-[20%] right-[10%] bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-[#fbbf24]/50"
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <span className="text-[#fbbf24] font-bold text-[1.5vw]">Match Score: 98%</span>
            </motion.div>
            <motion.div 
              className="absolute bottom-[25%] left-[5%] bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20"
              initial={{ opacity: 0, scale: 0, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            >
              <span className="text-white font-bold text-[1.2vw]">Verified Advocate</span>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}