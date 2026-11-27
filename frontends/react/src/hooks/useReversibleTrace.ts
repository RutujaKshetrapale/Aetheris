import { useState, useRef, useEffect, useCallback } from 'react';
import { AlgorithmType, GridModel, Keyframe, TraceDelta } from '../types/contract';
import { ReversibleTraceEngine, TraceSnapshot } from '../services/reversibleTraceEngine';

export function useReversibleTrace(initialGrid: GridModel) {
  const engineRef = useRef<ReversibleTraceEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new ReversibleTraceEngine(initialGrid);
  }

  const [grid, setGrid] = useState<GridModel>(initialGrid);
  const [snapshot, setSnapshot] = useState<TraceSnapshot>(() => engineRef.current!.getSnapshot());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(30);

  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncSnapshot = useCallback(() => {
    setSnapshot(engineRef.current!.getSnapshot());
  }, []);

  const resetToGrid = useCallback(
    (newGrid: GridModel) => {
      clearTimer();
      setIsPlaying(false);
      setGrid(newGrid);
      engineRef.current!.initGrid(newGrid);
      syncSnapshot();
    },
    [clearTimer, syncSnapshot]
  );

  const resetToInitialState = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
    engineRef.current!.resetToInitialState();
    syncSnapshot();
  }, [clearTimer, syncSnapshot]);

  const loadTrace = useCallback(
    (algorithm: AlgorithmType, trace: TraceDelta[], kf: Keyframe[] = []) => {
      clearTimer();
      setIsPlaying(false);
      engineRef.current!.loadTrace(algorithm, trace, kf);
      syncSnapshot();
    },
    [clearTimer, syncSnapshot]
  );

  const stepForward = useCallback(() => {
    const ok = engineRef.current!.stepForward();
    if (!ok) {
      setIsPlaying(false);
      return false;
    }
    syncSnapshot();
    return true;
  }, [syncSnapshot]);

  const stepBackward = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
    const ok = engineRef.current!.stepBackward();
    if (ok) {
      syncSnapshot();
    }
    return ok;
  }, [clearTimer, syncSnapshot]);

  const jumpToStep = useCallback(
    (targetStep: number) => {
      clearTimer();
      setIsPlaying(false);
      engineRef.current!.jumpToStep(targetStep);
      syncSnapshot();
    },
    [clearTimer, syncSnapshot]
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && engineRef.current!.getCurrentStep() + 1 >= engineRef.current!.getTotalSteps()) {
        engineRef.current!.resetToInitialState();
        syncSnapshot();
      }
      return !prev;
    });
  }, [syncSnapshot]);

  useEffect(() => {
    clearTimer();
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        const ok = engineRef.current!.stepForward();
        if (!ok) {
          clearTimer();
          setIsPlaying(false);
        } else {
          setSnapshot(engineRef.current!.getSnapshot());
        }
      }, playbackSpeed);
    }
    return clearTimer;
  }, [isPlaying, playbackSpeed, clearTimer]);

  return {
    grid,
    snapshot,
    cellStates: snapshot.cellStates,
    currentStep: snapshot.currentStep,
    totalSteps: snapshot.totalSteps,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    resetToGrid,
    resetToInitialState,
    loadTrace,
    stepForward,
    stepBackward,
    jumpToStep,
    togglePlay,
    setIsPlaying
  };
}
