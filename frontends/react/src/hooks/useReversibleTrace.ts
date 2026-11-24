import { useState, useRef, useEffect, useCallback } from 'react';
import { CellState, TraceDelta, GridModel } from '../types/contract';

export function useReversibleTrace(initialGrid: GridModel) {
  const [grid, setGrid] = useState<GridModel>(initialGrid);
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(() => {
    const map = new Map<string, CellState>();
    for (let r = 0; r < initialGrid.rows; r++) {
      for (let c = 0; c < initialGrid.cols; c++) {
        const id = `r${r}c${c}`;
        let type: CellState['cellType'] = 'EMPTY';
        if (id === initialGrid.startNode) type = 'START';
        else if (id === initialGrid.targetNode) type = 'TARGET';
        map.set(id, { cellType: type, traversalState: 'UNVISITED', inPath: false, gCost: null, fCost: null, parentId: null });
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
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(30); // ms per step

  const timerRef = useRef<number | null>(null);

  // Reset to initial grid state
  const resetToGrid = useCallback((newGrid: GridModel) => {
    setGrid(newGrid);
    setDeltas([]);
    setCurrentStep(-1);
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const map = new Map<string, CellState>();
    for (let r = 0; r < newGrid.rows; r++) {
      for (let c = 0; c < newGrid.cols; c++) {
        const id = `r${r}c${c}`;
        let type: CellState['cellType'] = 'EMPTY';
        if (id === newGrid.startNode) type = 'START';
        else if (id === newGrid.targetNode) type = 'TARGET';
        map.set(id, { cellType: type, traversalState: 'UNVISITED', inPath: false, gCost: null, fCost: null, parentId: null });
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

  // Set trace deltas from pathfinding response
  const loadTrace = useCallback((trace: TraceDelta[]) => {
    setDeltas(trace);
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

    setCellStates((prev) => {
      const nextMap = new Map(prev);
      nextMap.set(delta.nodeId, delta.afterState);
      return nextMap;
    });

    setCurrentStep(nextStep);
    return true;
  }, [currentStep, deltas]);

  // Step Backward: apply beforeState
  const stepBackward = useCallback(() => {
    if (currentStep < 0) return false;
    const delta = deltas[currentStep];

    setCellStates((prev) => {
      const nextMap = new Map(prev);
      nextMap.set(delta.nodeId, delta.beforeState);
      return nextMap;
    });

    setCurrentStep((prev) => prev - 1);
    return true;
  }, [currentStep, deltas]);

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
    currentStep,
    totalSteps: deltas.length,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    resetToGrid,
    loadTrace,
    stepForward,
    stepBackward,
    togglePlay,
    setIsPlaying
  };
}
