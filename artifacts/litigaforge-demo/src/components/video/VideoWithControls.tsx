import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const PROGRESS_TICK_MS = 60;
const AUDIO_SEEK_EPSILON_SEC = 0.18;
const AUDIO_VOLUME = 0.55;

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let ms = 0;
  for (const [key, dur] of Object.entries(SCENE_DURATIONS)) {
    out[key] = ms / 1000;
    ms += dur;
  }
  return out;
})();

interface ControlBarProps {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  muted: boolean;
  neverUnmuted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onToggleLock: () => void;
  onToggleMute: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}

function ProgressSegments({
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - start), PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;

  return (
    <div className="flex-1 flex items-center gap-1.5">
      {sceneKeys.map((key, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={key}
            onClick={() => onJumpTo(i)}
            className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-4 hover:bg-white/25 transition-all relative min-h-[12px]"
            aria-label={`Jump to scene ${i + 1}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <div
              className="absolute inset-y-0 left-0 bg-white/90 rounded-full transition-[width] duration-100"
              style={{ width: `${isActive ? progress * 100 : 0}%` }}
            />
          </button>
        );
      })}
    </div>
  );
}

function ControlBar({
  visible,
  collapsed,
  locked,
  muted,
  neverUnmuted,
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onToggleLock,
  onToggleMute,
  onJumpTo,
  onToggleCollapsed,
}: ControlBarProps) {
  return (
    <div
      className={`flex items-center gap-3 bg-black/50 backdrop-blur-sm px-5 py-4 transition-all duration-200 ease-out ${
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <button
        onClick={onToggleLock}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
          locked ? 'text-white bg-white/15 hover:bg-white/25' : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-pressed={locked}
      >
        <Repeat className="w-8 h-8" />
      </button>

      {/* Volume button — pulses when muted and never tapped */}
      <motion.button
        onClick={onToggleMute}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 relative ${
          muted ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-white bg-white/15 hover:bg-white/25'
        }`}
        animate={
          muted && neverUnmuted
            ? { boxShadow: ['0 0 0px #fff0', '0 0 16px #ffffff60', '0 0 0px #fff0'] }
            : {}
        }
        transition={{ duration: 1.6, repeat: Infinity }}
        style={{ borderRadius: 8 }}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
      </motion.button>

      <div className="w-px self-stretch bg-white/15" aria-hidden="true" />

      <ProgressSegments
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        tick={tick}
        onJumpTo={onJumpTo}
      />

      <div className="text-xl text-white/60 font-mono tabular-nums shrink-0">
        {activeIndex + 1}/{sceneKeys.length}
      </div>

      <button
        onClick={onToggleCollapsed}
        className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show controls' : 'Hide controls'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
      </button>
    </div>
  );
}

export default function VideoWithControls() {
  const {
    sceneKeys,
    activeIndex,
    locked,
    mountKey,
    tick,
    durations,
    activeDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
  } = useSceneControls(SCENE_DURATIONS);

  // Start muted (required for mobile autoplay). Imperative audio.muted + audio.play()
  // in the tap handler unlocks audio on iOS/Android — this MUST happen synchronously
  // inside the user-gesture handler, not in a useEffect.
  const [muted, setMuted] = useState(true);
  const [neverUnmuted, setNeverUnmuted] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-hide the tap-hint after 6s
  useEffect(() => {
    const id = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(id);
  }, []);

  // Set volume on mount
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = AUDIO_VOLUME;
  }, []);

  // Seek audio to match the current scene when it changes
  const handleSceneChange = useCallback(
    (sceneKey: string) => {
      onSceneChange(sceneKey);
      const audio = audioRef.current;
      if (!audio) return;
      const base = sceneKey.replace(/_r[12]$/, '');
      const target = SCENE_START_SEC[base] ?? 0;
      if (Math.abs(audio.currentTime - target) > AUDIO_SEEK_EPSILON_SEC) {
        audio.currentTime = target;
      }
    },
    [onSceneChange],
  );

  // Mute toggle: imperative audio.muted + audio.play() MUST run synchronously in
  // the click handler — this is what iOS/Android treat as a user gesture, allowing
  // audio playback. setMuted() triggers React re-render with muted={newMuted}.
  const handleToggleMute = useCallback(() => {
    const audio = audioRef.current;
    const newMuted = !muted;
    setMuted(newMuted);
    if (!newMuted) {
      setNeverUnmuted(false);
      setShowHint(false);
    }
    if (audio) {
      audio.muted = newMuted; // imperative: sync DOM before React reconciles
      if (!newMuted) {
        audio.play().catch(() => {}); // user-gesture frame → iOS unlocks audio here
      }
    }
  }, [muted]);

  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse') return;
      if (collapsed) setTapPinned(true);
    },
    [collapsed],
  );
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      if (!c) { setHovering(false); setTapPinned(false); }
      return !c;
    });
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const sensor = sensorRef.current;
      if (sensor && !sensor.contains(e.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapsed, tapPinned]);

  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative w-full h-screen">
      {/*
        Audio element: starts with muted={true} so mobile browsers allow autoPlay.
        Runtime unmute is done imperatively in handleToggleMute (user-gesture frame).
        muted={muted} keeps React's virtual DOM in sync after the imperative change.
      */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/composite_audio.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />

      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        onSceneChange={handleSceneChange}
      />

      {/* "Tap for audio" hint — visible for 6s when never yet unmuted */}
      <AnimatePresence>
        {muted && showHint && (
          <motion.div
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="bg-black/70 backdrop-blur-sm text-white text-[13px] font-mono px-4 py-2 rounded-full flex items-center gap-2 border border-white/20 whitespace-nowrap"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Volume2 className="w-4 h-4 shrink-0" />
              Tap <span className="font-bold">🔊</span> below for audio
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="flex-1 w-full" aria-hidden="true" />
        <ControlBar
          visible={barVisible}
          collapsed={collapsed}
          locked={locked}
          muted={muted}
          neverUnmuted={neverUnmuted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          tick={tick}
          onToggleLock={toggleLock}
          onToggleMute={handleToggleMute}
          onJumpTo={jumpTo}
          onToggleCollapsed={handleToggleCollapsed}
        />
      </div>
    </div>
  );
}
