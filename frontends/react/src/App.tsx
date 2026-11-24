import React, { useState, useEffect } from 'react';
import { AlgorithmType, GridModel, PathfindingResponse, HealthStatus } from './types/contract';
import { AetherisApiClient } from './services/api';
import { useReversibleTrace } from './hooks/useReversibleTrace';
import { GridCanvas } from './components/GridCanvas';
import { AlgorithmControls } from './components/AlgorithmControls';
import { MetricsPanel } from './components/MetricsPanel';

// Benchmark Canonical 5x5 Grid
const CANONICAL_GRID: GridModel = {
  rows: 5,
  cols: 5,
  startNode: 'r0c0',
  targetNode: 'r4c4',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1.0 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'TARGET', weight: 1.0 },
    { id: 'r1c2', row: 1, col: 2, cellType: 'WALL', weight: 1.0 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1.0 },
    { id: 'r3c2', row: 3, col: 2, cellType: 'WALL', weight: 1.0 },
    { id: 'r0c2', row: 0, col: 2, cellType: 'WEIGHTED', weight: 5.0 }
  ]
};

export const App: React.FC = () => {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>('DIJKSTRA');
  const [lastResponse, setLastResponse] = useState<PathfindingResponse | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
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
    togglePlay
  } = useReversibleTrace(CANONICAL_GRID);

  useEffect(() => {
    AetherisApiClient.getHealth()
      .then(setHealth)
      .catch((err) => console.warn('Backend not currently reachable:', err.message));
  }, []);

  const handleExecute = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await AetherisApiClient.findPath({
        algorithm: selectedAlgorithm,
        grid: CANONICAL_GRID
      });
      setLastResponse(res);
      loadTrace(res.traceDeltas);
      // Auto play forward
      togglePlay();
    } catch (err: any) {
      setError(err.message || 'Failed to execute pathfinding');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    resetToGrid(CANONICAL_GRID);
    setLastResponse(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="max-w-4xl w-full flex flex-col items-center text-center mb-8">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
            Frontend: React 19 • Canonical OpenAPI 3.2.0
          </span>
          {health && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Backend: {health.platform} ({health.persistenceEngine})
            </span>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-serif text-slate-100 mt-3 tracking-wide">
          AETHERIS
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl font-light">
          The Art of Algorithmic Thinking • Deterministic Cross-Platform Pathfinding & Reversible Trace Exploration
        </p>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full flex flex-col gap-6">
        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-mono">
            {error}
          </div>
        )}

        {/* Algorithm Controls */}
        <AlgorithmControls
          selectedAlgorithm={selectedAlgorithm}
          onSelectAlgorithm={setSelectedAlgorithm}
          onExecute={handleExecute}
          onReset={handleReset}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onStepForward={stepForward}
          onStepBackward={stepBackward}
          currentStep={currentStep}
          totalSteps={totalSteps}
          playbackSpeed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          isLoading={loading}
        />

        {/* Grid Visualization Canvas */}
        <GridCanvas grid={grid} cellStates={cellStates} />

        {/* Execution Metrics Panel */}
        <MetricsPanel
          metrics={lastResponse?.metrics ?? null}
          algorithm={selectedAlgorithm}
          pathFound={lastResponse?.pathFound ?? false}
          currentStep={currentStep}
          totalSteps={totalSteps}
        />
      </main>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-slate-500 font-mono">
        AETHERIS Revision 2.1.0 • 8-Configuration Cross-Platform Symmetry
      </footer>
    </div>
  );
};
