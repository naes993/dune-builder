import { useState, useCallback, useRef } from 'react';
import { DebugFrame, DebugRecording } from '../types/debug';

export const useDebugRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const framesRef = useRef<DebugFrame[]>([]);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(() => {
    framesRef.current = [];
    startTimeRef.current = Date.now();
    setIsRecording(true);
    console.log('[Debug Recorder] Started recording');
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    console.log(`[Debug Recorder] Stopped recording (${framesRef.current.length} frames)`);
  }, []);

  const addFrame = useCallback((frame: DebugFrame) => {
    if (!isRecording) return;
    framesRef.current.push(frame);
  }, [isRecording]);

  const downloadRecording = useCallback(() => {
    if (framesRef.current.length === 0) {
      alert('No recording data to download');
      return;
    }

    const recording: DebugRecording = {
      version: 1,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      frames: framesRef.current,
      metadata: {
        userAgent: navigator.userAgent,
        screenResolution: [window.innerWidth, window.innerHeight],
        description: prompt('Add description (optional):') || undefined,
      },
    };

    const json = JSON.stringify(recording, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.download = `dune-debug-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[Debug Recorder] Downloaded recording');
  }, []);

  const clearRecording = useCallback(() => {
    framesRef.current = [];
    startTimeRef.current = 0;
    console.log('[Debug Recorder] Cleared recording');
  }, []);

  return {
    isRecording,
    frameCount: framesRef.current.length,
    startRecording,
    stopRecording,
    addFrame,
    downloadRecording,
    clearRecording,
  };
};
