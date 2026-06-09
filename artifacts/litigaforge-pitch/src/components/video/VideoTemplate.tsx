import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  problem: 6000,
  solution: 8000,
  strategy: 8000,
  tools: 8000,
  outro: 7000
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0f172a] text-white">
      {/* Background Music */}
      <audio
        src={`${import.meta.env.BASE_URL}music.mp3`}
        autoPlay
        loop
        style={{ display: 'none' }}
      />

      {/* Background Video */}
      <video
        src={`${import.meta.env.BASE_URL}videos/hero-bg.mp4`}
        className="absolute inset-0 w-full h-full object-cover opacity-20"
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Persistent Animated Gradient */}
      <motion.div 
        className="absolute w-[80vw] h-[80vw] rounded-full opacity-10 blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }}
        animate={{ 
          x: ['-20%', '50%', '-10%'], 
          y: ['-10%', '40%', '10%'],
          scale: [1, 1.2, 0.9]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div 
        className="absolute w-[60vw] h-[60vw] rounded-full opacity-10 blur-[80px] pointer-events-none right-0 bottom-0"
        style={{ background: 'radial-gradient(circle, #fbbf24, transparent)' }}
        animate={{ 
          x: ['20%', '-40%', '10%'], 
          y: ['20%', '-20%', '0%'],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="problem" />}
        {currentScene === 1 && <Scene2 key="solution" />}
        {currentScene === 2 && <Scene3 key="strategy" />}
        {currentScene === 3 && <Scene4 key="tools" />}
        {currentScene === 4 && <Scene5 key="outro" />}
      </AnimatePresence>
    </div>
  );
}