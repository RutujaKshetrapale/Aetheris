import React, { useState, useEffect, useCallback } from 'react';
import {
  AlgorithmType,
  BenchmarkRecord,
  CellDefinition,
  GridModel,
  GridPreset,
  HealthStatus,
  PathfindingResponse
} from './types/contract';
import { AetherisApiClient, ApiError, getApiBaseUrl } from './services/api';
import { executeLocalPathfinding } from './services/localEngine';
import { useReversibleTrace } from './hooks/useReversibleTrace';
import { GridCanvas } from './components/GridCanvas';
import { AlgorithmControls, ToolType } from './components/AlgorithmControls';
import { MetricsPanel } from './components/MetricsPanel';

type ExecutionMode = 'BACKEND' | 'LOCAL_OFFLINE';

// Built-in quick grid templates
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

function formatApiError(err: unknown, fallbackMessage: string): string {
  if (err instanceof ApiError) {
    if (err.isNetworkError) {
      return `Backend API unreachable (${getApiBaseUrl()}). Verify the backend server is running or switch to Local Offline Engine mode.`;
    }
    if (err.problem) {
      return `HTTP ${err.problem.status} • ${err.problem.title}: ${err.problem.detail || err.message}`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallbackMessage;
}

export const App: React.FC = () => {
  const [currentGrid, setCurrentGrid] = useState<GridModel>(CANONICAL_5X5);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmType>('DIJKSTRA');
  const [activeTool, setActiveTool] = useState<ToolType>('WALL');
  const [weightValue, setWeightValue] = useState<number>(5);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('BACKEND');
  const [executionSource, setExecutionSource] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<PathfindingResponse | null>(null);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [presets, setPresets] = useState<GridPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [presetNameInput, setPresetNameInput] = useState<string>('Custom Grid Preset');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const [bundlePreview, setBundlePreview] = useState<string>('');
  const [lastBenchmark, setLastBenchmark] = useState<BenchmarkRecord | null>(null);

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

  const refreshHealthAndPresets = useCallback(async () => {
    try {
      const h = await AetherisApiClient.getHealth();
      setHealth(h);
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(formatApiError(err, 'Health check failed'));
      return;
    }

    try {
      const list = await AetherisApiClient.getPresets();
      setPresets(list);
      setPersistenceError(null);
      if (list.length > 0 && !selectedPresetId) {
        setSelectedPresetId(list[0].id);
      }
    } catch (err) {
      setPresets([]);
      setPersistenceError(formatApiError(err, 'Failed to load presets'));
    }
  }, [selectedPresetId]);

  useEffect(() => {
    refreshHealthAndPresets();
  }, [refreshHealthAndPresets]);

  const updateGridModel = useCallback(
    (newGrid: GridModel) => {
      setCurrentGrid(newGrid);
      resetToGrid(newGrid);
      setLastResponse(null);
      setExecutionSource(null);
      setError(null);
    },
    [resetToGrid]
  );

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

    if (id === currentGrid.startNode || id === currentGrid.targetNode) return;

    const existingCells = [...(currentGrid.cells || [])];
    const cellIdx = existingCells.findIndex((cell) => cell.id === id);

    if (activeTool === 'WALL') {
      if (cellIdx >= 0 && existingCells[cellIdx].cellType === 'WALL') {
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
      if (executionMode === 'BACKEND') {
        res = await AetherisApiClient.tracePath({
          algorithm: selectedAlgorithm,
          grid: currentGrid
        });
        setExecutionSource(health ? `Backend API • ${health.platform}` : `Backend API (${getApiBaseUrl()})`);
      } else {
        res = executeLocalPathfinding({
          algorithm: selectedAlgorithm,
          grid: currentGrid
        });
        setExecutionSource('Local Offline Engine (Client-Side Dev Mode)');
      }

      setLastResponse(res);
      loadTrace(res.traceDeltas, res.keyframes || []);
      setIsPlaying(true);
    } catch (err) {
      setLastResponse(null);
      setExecutionSource(null);
      setError(formatApiError(err, 'Failed to execute pathfinding'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    updateGridModel(currentGrid);
  };

  const handleLoadBackendPreset = async () => {
    if (!selectedPresetId) return;
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      const preset = await AetherisApiClient.getPreset(selectedPresetId);
      updateGridModel(preset.grid);
      setPersistenceMessage(`Loaded preset "${preset.name}" (${preset.id}).`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to load preset'));
    }
  };

  const handleSavePreset = async () => {
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      const created = await AetherisApiClient.createPreset({
        name: presetNameInput.trim() || 'Custom Grid Preset',
        description: `Saved from React workbench (${currentGrid.rows}x${currentGrid.cols})`,
        grid: currentGrid
      });
      setPresets((prev) => [...prev, created]);
      setSelectedPresetId(created.id);
      setPersistenceMessage(`Saved preset "${created.name}" (${created.id}).`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to save preset'));
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      await AetherisApiClient.deletePreset(selectedPresetId);
      const remaining = presets.filter((p) => p.id !== selectedPresetId);
      setPresets(remaining);
      setSelectedPresetId(remaining.length > 0 ? remaining[0].id : '');
      setPersistenceMessage(`Deleted preset ${selectedPresetId}.`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to delete preset'));
    }
  };

  const handleExportPresets = async () => {
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      const bundle = await AetherisApiClient.exportPresets();
      setBundlePreview(bundle);
      setPersistenceMessage('Exported canonical portable preset bundle.');
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to export presets'));
    }
  };

  const handleImportPresets = async () => {
    if (!bundlePreview.trim()) {
      setPersistenceError('Paste a canonical preset bundle JSON before importing.');
      return;
    }
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      const res = await AetherisApiClient.importPresets(bundlePreview);
      const list = await AetherisApiClient.getPresets();
      setPresets(list);
      setPersistenceMessage(`Imported ${res.importedCount} preset(s) from bundle.`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to import preset bundle'));
    }
  };

  const handleRunBenchmark = async () => {
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      const record = await AetherisApiClient.runBenchmark({
        name: `${selectedAlgorithm} ${currentGrid.rows}x${currentGrid.cols}`,
        algorithm: selectedAlgorithm,
        grid: currentGrid
      });
      setLastBenchmark(record);
      setPersistenceMessage(`Benchmark recorded: ${record.id} (${record.executionTimeMs} ms).`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to record benchmark'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="max-w-5xl w-full flex flex-col items-center text-center mb-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
            React 19.3.1 • OpenAPI 3.2.0
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest border ${
              health
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            Backend: {health ? `${health.platform} (${health.engineStatus})` : 'Unavailable'}
          </span>
          {health && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest border ${
                health.persistenceStatus === 'UP'
                  ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
            >
              Persistence: {health.persistenceEngine} ({health.persistenceStatus}) • DB Connected:{' '}
              {health.databaseConnected ? 'true' : 'false'}
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold font-serif text-slate-100 mt-2 tracking-wide">
          AETHERIS
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl font-light">
          The Art of Algorithmic Thinking • Deterministic Cross-Platform Pathfinding & Reversible Trace Engine
        </p>

        {/* Execution Mode Switcher & Source Indicator */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setExecutionMode('BACKEND')}
              className={`px-3 py-1 rounded-md transition ${
                executionMode === 'BACKEND'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Backend API ({getApiBaseUrl()})
            </button>
            <button
              onClick={() => setExecutionMode('LOCAL_OFFLINE')}
              className={`px-3 py-1 rounded-md transition ${
                executionMode === 'LOCAL_OFFLINE'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Offline Local Engine (Dev)
            </button>
          </div>
          <button
            onClick={refreshHealthAndPresets}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] font-mono text-slate-300"
          >
            Refresh Health
          </button>
        </div>

        {executionSource && (
          <div className="mt-2 px-3 py-1 rounded-full text-[11px] font-mono bg-slate-900 border border-slate-700 text-slate-300">
            Last Execution Source: <span className="text-amber-300 font-bold">{executionSource}</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full flex flex-col gap-5">
        {healthError && executionMode === 'BACKEND' && (
          <div className="p-3 bg-amber-950/50 border border-amber-700/70 rounded-xl text-amber-200 text-xs font-mono">
            Health Notice: {healthError}
          </div>
        )}

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
            Pathfinding Error: {error}
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

        {/* Backend Persistence & Benchmark Panel (Independent of Core Pathfinding) */}
        <section className="flex flex-col gap-3 p-5 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-serif font-bold text-slate-200 tracking-wide">
              Backend Presets & Benchmarks
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Persistence Adapter: {health ? `${health.persistenceEngine} (${health.persistenceStatus})` : 'Unknown'}
            </span>
          </div>

          {persistenceError && (
            <div className="p-3 bg-amber-950/60 border border-amber-700 rounded-xl text-amber-200 text-xs font-mono">
              Persistence Notice (Core Pathfinding Unaffected): {persistenceError}
            </div>
          )}

          {persistenceMessage && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-700/60 rounded-xl text-emerald-300 text-xs font-mono">
              {persistenceMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
            >
              {presets.length === 0 ? (
                <option value="">No persisted presets</option>
              ) : (
                presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))
              )}
            </select>
            <button
              onClick={handleLoadBackendPreset}
              disabled={!selectedPresetId}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono disabled:opacity-40"
            >
              Load Preset
            </button>
            <button
              onClick={handleDeletePreset}
              disabled={!selectedPresetId}
              className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900/70 border border-rose-800/60 text-rose-200 rounded-lg text-xs font-mono disabled:opacity-40"
            >
              Delete Preset
            </button>

            <input
              type="text"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder="Preset name"
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
            />
            <button
              onClick={handleSavePreset}
              className="px-3 py-1.5 bg-sky-600/80 hover:bg-sky-500 text-white rounded-lg text-xs font-mono"
            >
              Save Grid Preset
            </button>
            <button
              onClick={handleRunBenchmark}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded-lg text-xs font-mono"
            >
              Record Benchmark
            </button>
          </div>

          {lastBenchmark && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 flex flex-wrap gap-4">
              <span>Benchmark ID: <strong className="text-amber-300">{lastBenchmark.id}</strong></span>
              <span>Algorithm: {lastBenchmark.algorithm}</span>
              <span>Grid: {lastBenchmark.gridRows}x{lastBenchmark.gridCols}</span>
              <span>Path Cost: {lastBenchmark.algorithmPathCost ?? '—'}</span>
              <span>Visited: {lastBenchmark.nodesVisited}</span>
              <span>Duration: {lastBenchmark.executionTimeMs} ms</span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportPresets}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-mono"
              >
                Export Bundle
              </button>
              <button
                onClick={handleImportPresets}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-mono"
              >
                Import Bundle
              </button>
            </div>
            <textarea
              value={bundlePreview}
              onChange={(e) => setBundlePreview(e.target.value)}
              rows={4}
              placeholder="Canonical portable preset bundle JSON (export or paste to import)..."
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-10 text-center text-xs text-slate-600 font-mono">
        AETHERIS Revision 2.1.0 • Pure Determinism & Full Bidirectional Trace Reversibility
      </footer>
    </div>
  );
};
