import React, { useState, useEffect, useCallback } from 'react';
import {
  AlgorithmType,
  GridModel,
  PathfindingResponse,
  HealthStatus,
  CellDefinition
} from './types/contract';
import { AetherisApiClient } from './services/api';
import { executeLocalPathfinding } from './services/localEngine';
import { useReversibleTrace } from './hooks/useReversibleTrace';
import { GridCanvas } from './components/GridCanvas';
import { AlgorithmControls, ToolType } from './components/AlgorithmControls';
import { MetricsPanel } from './components/MetricsPanel';

// Presets
const CANONICAL_5X5: GridModel = {
  rows: 5,
  cols: 5,
  startNode: 'r0c0',
  targetNode: 'r4c4',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'TARGET', weight: 1 },
    { id: 'r1c2', row: 1, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r3c2', row: 3, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r0c2', row: 0, col: 2, cellType: 'WEIGHTED', weight: 5 }
  ]
};

const DIVERGENCE_3X4: GridModel = {
  rows: 3,
  cols: 4,
  startNode: 'r0c0',
  targetNode: 'r0c3',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r0c3', row: 0, col: 3, cellType: 'TARGET', weight: 1 },
    { id: 'r0c1', row: 0, col: 1, cellType: 'WEIGHTED', weight: 50 },
    { id: 'r0c2', row: 0, col: 2, cellType: 'WEIGHTED', weight: 50 }
  ]
};

const LARGE_8X8: GridModel = {
  rows: 8,
  cols: 8,
  startNode: 'r0c0',
  targetNode: 'r7c7',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r7c7', row: 7, col: 7, cellType: 'TARGET', weight: 1 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r3c2', row: 3, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r4c2', row: 4, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r4c3', row: 4, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'WALL', weight: 1 },
    { id: 'r2c5', row: 2, col: 5, cellType: 'WEIGHTED', weight: 15 },
    { id: 'r3c5', row: 3, col: 5, cellType: 'WEIGHTED', weight: 15 }
  ]
};

export const App: React.FC = () => {
  const [currentGrid, setCurrentGrid] = useState<GridModel>(CANONICAL_5X5);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>('DIJKSTRA');
  const [activeTool, setActiveTool] = useState<ToolType>('WALL');
  const [weightValue, setWeightValue] = useState<number>(5);
  const [lastResponse, setLastResponse] = useState<PathfindingResponse | null>(null);
  const [backendStatus, setBackendStatus] = useState<string>('Connecting...');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const {
    grid,
    cellStates,
    currentStep,
    totalSteps,
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
  } = useReversibleTrace(currentGrid);

  // Health check on mount
  useEffect(() => {
    AetherisApiClient.getHealth()
      .then((h: HealthStatus) => {
        setBackendStatus(`${h.platform} (${h.persistenceEngine})`);
      })
      .catch(() => {
        setBackendStatus('Client Deterministic Engine (Offline Parity)');
      });
  }, []);

  // Update reversible trace whenever currentGrid is modified
  const updateGridModel = useCallback(
    (newGrid: GridModel) => {
      setCurrentGrid(newGrid);
      resetToGrid(newGrid);
      setLastResponse(null);
      setError(null);
    },
    [resetToGrid]
  );

  // Cell interaction handler
  const handleCellInteract = (id: string) => {
    const parts = id.slice(1).split('c');
    const r = parseInt(parts[0], 10);
    const c = parseInt(parts[1], 10);

    if (activeTool === 'START') {
      if (id === currentGrid.targetNode) return;
      const nextCells = (currentGrid.cells || []).filter(
        (cell) => cell.id !== id && cell.id !== currentGrid.startNode
      );
      updateGridModel({
        ...currentGrid,
        startNode: id,
        cells: nextCells
      });
      return;
    }

    if (activeTool === 'TARGET') {
      if (id === currentGrid.startNode) return;
      const nextCells = (currentGrid.cells || []).filter(
        (cell) => cell.id !== id && cell.id !== currentGrid.targetNode
      );
      updateGridModel({
        ...currentGrid,
        targetNode: id,
        cells: nextCells
      });
      return;
    }

    // Do not alter start or target cells with wall/weight/eraser
    if (id === currentGrid.startNode || id === currentGrid.targetNode) return;

    let existingCells = [...(currentGrid.cells || [])];
    const cellIdx = existingCells.findIndex((cell) => cell.id === id);

    if (activeTool === 'WALL') {
      if (cellIdx >= 0 && existingCells[cellIdx].cellType === 'WALL') {
        // Toggle off
        existingCells.splice(cellIdx, 1);
      } else {
        const newDef: CellDefinition = { id, row: r, col: c, cellType: 'WALL', weight: 1 };
        if (cellIdx >= 0) existingCells[cellIdx] = newDef;
        else existingCells.push(newDef);
      }
    } else if (activeTool === 'WEIGHTED') {
      const newDef: CellDefinition = {
        id,
        row: r,
        col: c,
        cellType: 'WEIGHTED',
        weight: weightValue
      };
      if (cellIdx >= 0) existingCells[cellIdx] = newDef;
      else existingCells.push(newDef);
    } else if (activeTool === 'ERASER') {
      if (cellIdx >= 0) existingCells.splice(cellIdx, 1);
    }

    updateGridModel({
      ...currentGrid,
      cells: existingCells
    });
  };

  const handleClearWalls = () => {
    const filtered = (currentGrid.cells || []).filter((cell) => cell.cellType !== 'WALL');
    updateGridModel({ ...currentGrid, cells: filtered });
  };

  const handleClearWeights = () => {
    const filtered = (currentGrid.cells || []).filter((cell) => cell.cellType !== 'WEIGHTED');
    updateGridModel({ ...currentGrid, cells: filtered });
  };

  const handleLoadPreset = (name: 'canonical' | 'divergence' | 'large') => {
    if (name === 'canonical') updateGridModel(CANONICAL_5X5);
    else if (name === 'divergence') updateGridModel(DIVERGENCE_3X4);
    else if (name === 'large') updateGridModel(LARGE_8X8);
  };

  const handleExecute = async () => {
    try {
      setLoading(true);
      setError(null);

      let res: PathfindingResponse;
      try {
        // Try live backend API first
        res = await AetherisApiClient.tracePath({
          algorithm: selectedAlgorithm,
          grid: currentGrid
        });
      } catch (networkErr: any) {
        // Fallback to local client engine with exact canonical parity
        res = executeLocalPathfinding({
          algorithm: selectedAlgorithm,
          grid: currentGrid
        });
      }

      setLastResponse(res);
      loadTrace(res.traceDeltas, res.keyframes || []);
      // Start auto-playback
      setIsPlaying(true);
    } catch (err: any) {
      setError(err.message || 'Failed to execute pathfinding');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    updateGridModel(currentGrid);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="max-w-4xl w-full flex flex-col items-center text-center mb-6">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
            React 19.3.1 • OpenAPI 3.2.0
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Engine: {backendStatus}
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-serif text-slate-100 mt-2 tracking-wide">
          AETHERIS
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl font-light">
          The Art of Algorithmic Thinking • Deterministic Cross-Platform Pathfinding & Reversible Trace Engine
        </p>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full flex flex-col gap-5">
        <AlgorithmControls
          selectedAlgorithm={selectedAlgorithm}
          onSelectAlgorithm={setSelectedAlgorithm}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          weightValue={weightValue}
          onWeightChange={setWeightValue}
          onExecute={handleExecute}
          onReset={handleReset}
          onClearWalls={handleClearWalls}
          onClearWeights={handleClearWeights}
          onLoadPreset={handleLoadPreset}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onStepForward={stepForward}
          onStepBackward={stepBackward}
          onScrub={jumpToStep}
          currentStep={currentStep}
          totalSteps={totalSteps}
          playbackSpeed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          isLoading={loading}
        />

        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs font-mono">
            Error: {error}
          </div>
        )}

        <MetricsPanel
          metrics={lastResponse?.metrics ?? null}
          algorithm={lastResponse?.algorithm ?? selectedAlgorithm}
          pathFound={lastResponse?.pathFound ?? false}
          currentStep={currentStep}
          totalSteps={totalSteps}
        />

        <GridCanvas
          grid={grid}
          cellStates={cellStates}
          onCellInteract={handleCellInteract}
        />
      </main>

      {/* Footer */}
      <footer className="mt-10 text-center text-xs text-slate-600 font-mono">
        AETHERIS Revision 2.1.0 • Pure Determinism & Full Bidirectional Trace Reversibility
      </footer>
    </div>
  );
};
