import { useState, useEffect } from 'react';

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const sceneKeys = Object.keys(durations);

  useEffect(() => {
    // @ts-ignore
    window.startRecording?.();

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const playScene = (index: number) => {
      if (!isMounted) return;
      setCurrentSceneIndex(index);

      const sceneKey = sceneKeys[index];
      const duration = durations[sceneKey];

      timeoutId = setTimeout(() => {
        if (index === sceneKeys.length - 1) {
          // @ts-ignore
          window.stopRecording?.();
          playScene(0); // Loop
        } else {
          playScene(index + 1);
        }
      }, duration);
    };

    playScene(0);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [JSON.stringify(durations)]);

  return { currentScene: currentSceneIndex };
}