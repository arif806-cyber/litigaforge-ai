import { useState, useRef, useEffect } from 'react';
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!started) {
      audio.play().then(() => {
        setStarted(true);
      }).catch(() => {});
    }
  }, [started]);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!started) {
      audio.play().then(() => {
        audio.muted = false;
        setMuted(false);
        setStarted(true);
      }).catch(() => {});
    } else {
      audio.muted = !audio.muted;
      setMuted(audio.muted);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0f172a] text-white">
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}music.mp3`}
        loop
        muted
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

      {/* Mute/Unmute button */}
      <button
        onClick={toggleMute}
        className="absolute bottom-5 right-5 z-50 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-all"
        style={{
          background: muted ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.9)',
          border: '1px solid rgba(245,158,11,0.5)',
          color: muted ? '#f59e0b' : '#0f172a',
          backdropFilter: 'blur(8px)',
        }}
      >
        {muted ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            Tap for sound
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
            Sound on
          </>
        )}
      </button>
    </div>
  );
}
