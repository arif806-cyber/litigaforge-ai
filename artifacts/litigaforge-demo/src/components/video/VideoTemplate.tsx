import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';

export const SCENE_DURATIONS: Record<string, number> = {
  intro: 8000,
  problem: 10000,
  case: 8000,
  matching: 10000,
  forge: 14000,
  synthesis: 10000,
  carousel: 15000,
  closing: 8000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1,
  problem: Scene2,
  case: Scene3,
  matching: Scene4,
  forge: Scene5,
  synthesis: Scene6,
  carousel: Scene7,
  closing: Scene8,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

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
            x: sceneIndex % 2 === 0 ? '5%' : '-5%',
            y: sceneIndex % 2 === 0 ? '5%' : '-5%',
            scale: sceneIndex % 2 === 0 ? 1.05 : 0.95,
          }}
          transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[120px] opacity-10 bottom-[-10%] right-[-10%] pointer-events-none"
          style={{ background: 'var(--color-secondary)' }}
          animate={{
            x: sceneIndex % 2 === 0 ? '-10%' : '10%',
            y: sceneIndex % 2 === 0 ? '-10%' : '10%',
            scale: sceneIndex % 2 === 0 ? 0.9 : 1.1,
          }}
          transition={{ duration: 12, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
        />
      </div>

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
