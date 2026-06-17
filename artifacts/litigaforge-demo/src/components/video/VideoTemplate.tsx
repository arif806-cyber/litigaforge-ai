import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';

const SCENE_DURATIONS = {
  intro: 8000,
  problem: 10000,
  case: 8000,
  matching: 10000,
  forge: 14000,
  synthesis: 10000,
  carousel: 15000,
  closing: 8000
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div
      className="w-full h-screen overflow-hidden relative bg-bg-light"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[100px] opacity-20 top-[-20%] left-[-20%] pointer-events-none"
          style={{ background: 'var(--color-primary)' }}
          animate={{
            x: currentScene % 2 === 0 ? '5%' : '-5%',
            y: currentScene % 2 === 0 ? '5%' : '-5%',
            scale: currentScene % 2 === 0 ? 1.05 : 0.95,
          }}
          transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[120px] opacity-10 bottom-[-10%] right-[-10%] pointer-events-none"
          style={{ background: 'var(--color-secondary)' }}
          animate={{
            x: currentScene % 2 === 0 ? '-10%' : '10%',
            y: currentScene % 2 === 0 ? '-10%' : '10%',
            scale: currentScene % 2 === 0 ? 0.9 : 1.1,
          }}
          transition={{ duration: 12, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
        />
      </div>

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="intro" />}
        {currentScene === 1 && <Scene2 key="problem" />}
        {currentScene === 2 && <Scene3 key="case" />}
        {currentScene === 3 && <Scene4 key="matching" />}
        {currentScene === 4 && <Scene5 key="forge" />}
        {currentScene === 5 && <Scene6 key="synthesis" />}
        {currentScene === 6 && <Scene7 key="carousel" />}
        {currentScene === 7 && <Scene8 key="closing" />}
      </AnimatePresence>
    </div>
  );
}
