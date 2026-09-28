// ─────────────────────────────────────────────────────────────────────────────
//  useAudioCapture.ts — React hook wrapping AudioCapture
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback, useEffect } from 'react';
import { audioCapture } from '../services/audioCapture';

/**
 * Provides real-time audio capture state from the shared AudioCapture singleton.
 *
 * - `isCapturing` and `audioLevel` always reflect the singleton's current state
 *   (safe to call from multiple components simultaneously).
 * - `startCapture` / `stopCapture` are provided for the caller that owns the session.
 */
export function useAudioCapture() {
  const [isCapturing, setIsCapturing] = useState(audioCapture.isRunning);
  const [audioLevel, setAudioLevel]   = useState(0);
  const levelTimerRef = useRef<number | null>(null);

  // Poll the singleton for live level + running state at ~20 fps
  const startPolling = useCallback(() => {
    if (levelTimerRef.current !== null) return; // already polling
    levelTimerRef.current = window.setInterval(() => {
      setIsCapturing(audioCapture.isRunning);
      setAudioLevel(audioCapture.isRunning ? audioCapture.getAudioLevel() : 0);
    }, 50);
  }, []);

  const stopPolling = useCallback(() => {
    if (levelTimerRef.current !== null) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Begin polling immediately so any component can read live state
  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  const startCapture = useCallback(
    async (onAudioChunk: (chunk: ArrayBuffer) => void) => {
      await audioCapture.start(onAudioChunk);
      setIsCapturing(true);
    },
    [],
  );

  const stopCapture = useCallback(() => {
    audioCapture.stop();
    setIsCapturing(false);
    setAudioLevel(0);
  }, []);

  return { isCapturing, audioLevel, startCapture, stopCapture };
}

