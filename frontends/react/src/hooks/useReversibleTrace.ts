import { useState, useRef, useEffect, useCallback } from 'react';
import { CellState, TraceDelta, GridModel, Keyframe } from '../types/contract';

export function useReversibleTrace(initialGrid: GridModel) {
  const [grid, setGrid] = useState<GridModel>(initialGrid);
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(() => {
    const map = new Map<string, CellState>();
    for (let r = 0; r < initialGrid.rows; r++) {
      for (let c = 0; c < initialGrid.cols; c++) {
        const id = `r${r}c${c}`;
        let type: CellState['cellType'] = 'EMPTY';
        if (id === initialGrid.targetNode) type = 'TARGET';
        if (id === initialGrid.startNode) type = 'START';
        map.set(id, { cellType: type, traversalState: 'UNVISITED', inPath: false, gCost: null, hCost: null, fCost: null, parentId: null });
      }
    }
    if (initialGrid.cells) {
      for (const cell of initialGrid.cells) {
        const cur = map.get(cell.id);
        if (cur) map.set(cell.id, { ...cur, cellType: cell.cellType });
      }
    }
    return map;
  });

  const [deltas, setDeltas] = useState<TraceDelta[]>([]);
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(30); // ms per step

  const timerRef = useRef<number | null>(null);

  // Reset to initial grid state
  const resetToGrid = useCallback((newGrid: GridModel) => {
    setGrid(newGrid);
    setDeltas([]);
    setKeyframes([]);
    setCurrentStep(-1);
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const map = new Map<string, CellState>();
    for (let r = 0; r < newGrid.rows; r++) {
      for (let c = 0; c < newGrid.cols; c++) {
        const id = `r${r}c${c}`;
        let type: CellState['cellType'] = 'EMPTY';
        if (id === newGrid.targetNode) type = 'TARGET';
        if (id === newGrid.startNode) type = 'START';
        map.set(id, { cellType: type, traversalState: 'UNVISITED', inPath: false, gCost: null, hCost: null, fCost: null, parentId: null });
      }
    }
    if (newGrid.cells) {
      for (const cell of newGrid.cells) {
        const cur = map.get(cell.id);
        if (cur) map.set(cell.id, { ...cur, cellType: cell.cellType });
      }
    }
    setCellStates(map);
  }, []);

  // Set trace deltas and keyframes from pathfinding response
  const loadTrace = useCallback((trace: TraceDelta[], kf: Keyframe[] = []) => {
    setDeltas(trace);
    setKeyframes(kf);
    setCurrentStep(-1);
    setIsPlaying(false);
  }, []);

  // Step Forward: apply afterState
  const stepForward = useCallback(() => {
    if (currentStep + 1 >= deltas.length) {
      setIsPlaying(false);
      return false;
    }
    const nextStep = currentStep + 1;
    const delta = deltas[nextStep];

    if (delta.nodeId && delta.afterState) {
      setCellStates((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(delta.nodeId!, delta.afterState!);
        return nextMap;
      });
    }

    setCurrentStep(nextStep);
    return true;
  }, [currentStep, deltas]);

  // Step Backward: apply beforeState
  const stepBackward = useCallback(() => {
    if (currentStep < 0) return false;
    const delta = deltas[currentStep];

    if (delta.nodeId && delta.beforeState) {
      setCellStates((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(delta.nodeId!, delta.beforeState!);
        return nextMap;
      });
    }

    setCurrentStep((prev) => prev - 1);
    return true;
  }, [currentStep, deltas]);

  // Jump to specific step using keyframe acceleration
  const jumpToStep = useCallback((targetStep: number) => {
    if (targetStep < -1 || targetStep >= deltas.length) return;
    if (targetStep === -1) {
      resetToGrid(grid);
      return;
    }

    // Find nearest keyframe <= targetStep
    let bestKeyframe: Keyframe | null = null;
    for (const kf of keyframes) {
      if (kf.step <= targetStep && (bestKeyframe === null || kf.step > bestKeyframe.step)) {
        bestKeyframe = kf;
      }
    }

    const state = new Map<string, CellState>();
    let startStep = 0;

    if (bestKeyframe) {
      for (const [id, cs] of Object.entries(bestKeyframe.cellStates)) {
        state.set(id, { ...cs });
      }
      startStep = bestKeyframe.step + 1;
    } else {
      // Rebuild from initial grid
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const id = `r${r}c${c}`;
          let type: CellState['cellType'] = 'EMPTY';
          if (id === grid.targetNode) type = 'TARGET';
          if (id === grid.startNode) type = 'START';
          state.set(id, { cellType: type, traversalState: 'UNVISITED', inPath: false, gCost: null, hCost: null, fCost: null, parentId: null });
        }
      }
      if (grid.cells) {
        for (const cell of grid.cells) {
          const cur = state.get(cell.id);
          if (cur) state.set(cell.id, { ...cur, cellType: cell.cellType });
        }
      }
    }

    // Fast-forward deltas from startStep to targetStep
    for (let i = startStep; i <= targetStep; i++) {
      const d = deltas[i];
      if (d.nodeId && d.afterState) {
        state.set(d.nodeId, d.afterState);
      }
    }

    setCellStates(state);
    setCurrentStep(targetStep);
  }, [deltas, keyframes, grid, resetToGrid]);

  // Play / Pause auto playback
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        stepForward();
      }, playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, stepForward]);

  return {
    grid,
    cellStates,
    deltas,
    keyframes,
    currentStep,
    totalSteps: deltas.length,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    resetToGrid,
    loadTrace,
    stepForward,
    stepBackward,
    jumpToStep,
    togglePlay,
    setIsPlaying
  };
}
