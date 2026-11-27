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
import { AetherisApiClient, ApiError, getApiBaseUrl, setApiBaseUrl } from './services/api';
import { executeLocalPathfinding } from './services/localEngine';
import { useReversibleTrace } from './hooks/useReversibleTrace';
import { GridCanvas } from './components/GridCanvas';
import { AlgorithmControls, ToolType } from './components/AlgorithmControls';
import { MetricsPanel } from './components/MetricsPanel';
import { TraceInspector } from './components/TraceInspector';

type ExecutionMode = 'BACKEND' | 'LOCAL_OFFLINE';

const BENCHMARK_HISTORY_KEY = 'aetheris.react.benchmarkIds';

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

function parseNodeCoords(id: string): { row: number; col: number } {
  const parts = id.slice(1).split('c');
  return { row: parseInt(parts[0], 10), col: parseInt(parts[1], 10) };
}

function formatApiError(err: unknown, fallbackMessage: string): string {
  if (err instanceof ApiError) {
    if (err.isNetworkError) {
      return `Backend API unreachable (${getApiBaseUrl()}). Verify the backend server is running or explicitly switch to Offline Local Engine (Dev) mode.`;
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
  const [apiUrlInput, setApiUrlInput] = useState<string>(getApiBaseUrl());
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

  const [benchmarkNameInput, setBenchmarkNameInput] = useState<string>('');
  const [benchmarkIdInput, setBenchmarkIdInput] = useState<string>('');
  const [lastBenchmark, setLastBenchmark] = useState<BenchmarkRecord | null>(null);
  const [recentBenchmarkIds, setRecentBenchmarkIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(BENCHMARK_HISTORY_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const {
    grid,
    snapshot,
    cellStates,
    currentStep,
    totalSteps,
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
  } = useReversibleTrace(currentGrid);

  const refreshHealthAndPresets = useCallback(async () => {
    try {
      const h = await AetherisApiClient.getHealth();
      setHealth(h);
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(formatApiError(err, 'Health check failed'));
      setPresets([]);
      return;
    }

    try {
      const list = await AetherisApiClient.getPresets();
      setPresets(list);
      setPersistenceError(null);
      setSelectedPresetId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]?.id || ''));
    } catch (err) {
      setPresets([]);
      setPersistenceError(formatApiError(err, 'Failed to load presets'));
    }
  }, []);

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

  const handleResizeGrid = (newRows: number, newCols: number) => {
    const startCoords = parseNodeCoords(currentGrid.startNode);
    const targetCoords = parseNodeCoords(currentGrid.targetNode);

    const clampedStartRow = Math.min(startCoords.row, newRows - 1);
    const clampedStartCol = Math.min(startCoords.col, newCols - 1);
    let clampedTargetRow = Math.min(targetCoords.row, newRows - 1);
    let clampedTargetCol = Math.min(targetCoords.col, newCols - 1);

    let nextStart = `r${clampedStartRow}c${clampedStartCol}`;
    let nextTarget = `r${clampedTargetRow}c${clampedTargetCol}`;
    if (nextStart === nextTarget) {
      clampedTargetRow = newRows - 1;
      clampedTargetCol = newCols - 1;
      nextTarget = `r${clampedTargetRow}c${clampedTargetCol}`;
      if (nextStart === nextTarget) {
        nextStart = 'r0c0';
      }
    }

    const keptCells = (currentGrid.cells || []).filter((cell) => {
      if (cell.row >= newRows || cell.col >= newCols) return false;
      if (cell.id === nextStart || cell.id === nextTarget) return false;
      return cell.cellType === 'WALL' || cell.cellType === 'WEIGHTED';
    });

    const startDef = parseNodeCoords(nextStart);
    const targetDef = parseNodeCoords(nextTarget);

    updateGridModel({
      rows: newRows,
      cols: newCols,
      startNode: nextStart,
      targetNode: nextTarget,
      cells: [
        { id: nextStart, row: startDef.row, col: startDef.col, cellType: 'START', weight: 1 },
        { id: nextTarget, row: targetDef.row, col: targetDef.col, cellType: 'TARGET', weight: 1 },
        ...keptCells
      ]
    });
  };

  const handleCellInteract = (id: string) => {
    const { row: r, col: c } = parseNodeCoords(id);

    if (activeTool === 'START') {
      if (id === currentGrid.targetNode) return;
      const nextCells = (currentGrid.cells || []).filter(
        (cell) => cell.id !== id && cell.id !== currentGrid.startNode
      );
      nextCells.push({ id, row: r, col: c, cellType: 'START', weight: 1 });
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
      nextCells.push({ id, row: r, col: c, cellType: 'TARGET', weight: 1 });
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
      const clampedWeight = Math.max(2, Math.min(100, Math.floor(weightValue || 5)));
      const newDef: CellDefinition = {
        id,
        row: r,
        col: c,
        cellType: 'WEIGHTED',
        weight: clampedWeight
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

  const handleClearAll = () => {
    const s = parseNodeCoords(currentGrid.startNode);
    const t = parseNodeCoords(currentGrid.targetNode);
    updateGridModel({
      ...currentGrid,
      cells: [
        { id: currentGrid.startNode, row: s.row, col: s.col, cellType: 'START', weight: 1 },
        { id: currentGrid.targetNode, row: t.row, col: t.col, cellType: 'TARGET', weight: 1 }
      ]
    });
  };

  const handleLoadTemplate = (name: 'canonical' | 'divergence' | 'large') => {
    if (name === 'canonical') updateGridModel(CANONICAL_5X5);
    else if (name === 'divergence') updateGridModel(DIVERGENCE_3X4);
    else if (name === 'large') updateGridModel(LARGE_8X8);
  };

  const handleApplyApiUrl = () => {
    setApiBaseUrl(apiUrlInput);
    setApiUrlInput(getApiBaseUrl());
    refreshHealthAndPresets();
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
        setExecutionSource('Offline Local Engine (Explicit Dev Mode)');
      }

      setLastResponse(res);
      loadTrace(res.algorithm, res.traceDeltas, res.keyframes || []);
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
      setPresetNameInput(preset.name);
      updateGridModel(preset.grid);
      setPersistenceMessage(`Loaded preset "${preset.name}" (${preset.id}).`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to load preset'));
    }
  };

  const handleCreatePreset = async () => {
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
      setPersistenceMessage(`Created preset "${created.name}" (${created.id}).`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to create preset'));
    }
  };

  const handleUpdatePreset = async () => {
    if (!selectedPresetId) return;
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      const updated = await AetherisApiClient.updatePreset(selectedPresetId, {
        id: selectedPresetId,
        name: presetNameInput.trim() || 'Updated Grid Preset',
        description: `Updated from React workbench (${currentGrid.rows}x${currentGrid.cols})`,
        grid: currentGrid
      });
      setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setPersistenceMessage(`Updated preset "${updated.name}" (${updated.id}).`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to update preset'));
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;
    const targetId = selectedPresetId;
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      await AetherisApiClient.deletePreset(targetId);
      const remaining = presets.filter((p) => p.id !== targetId);
      setPresets(remaining);
      setSelectedPresetId(remaining.length > 0 ? remaining[0].id : '');
      setPersistenceMessage(`Deleted preset ${targetId}.`);
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

  const handleDownloadBundle = () => {
    if (!bundlePreview.trim()) return;
    const blob = new Blob([bundlePreview], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aetheris-presets.bundle.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBundlePreview(text);
    e.target.value = '';
  };

  const handleImportPresets = async () => {
    if (!bundlePreview.trim()) {
      setPersistenceError('Paste or upload a canonical preset bundle JSON before importing.');
      return;
    }
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      const res = await AetherisApiClient.importPresets(bundlePreview);
      const list = await AetherisApiClient.getPresets();
      setPresets(list);
      if (list.length > 0 && !selectedPresetId) {
        setSelectedPresetId(list[0].id);
      }
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
        name: benchmarkNameInput.trim() || `${selectedAlgorithm} ${currentGrid.rows}x${currentGrid.cols}`,
        algorithm: selectedAlgorithm,
        grid: currentGrid
      });
      setLastBenchmark(record);
      setBenchmarkIdInput(record.id);
      const nextIds = [record.id, ...recentBenchmarkIds.filter((id) => id !== record.id)].slice(0, 10);
      setRecentBenchmarkIds(nextIds);
      try {
        localStorage.setItem(BENCHMARK_HISTORY_KEY, JSON.stringify(nextIds));
      } catch {
        // ignore storage quota errors
      }
      setPersistenceMessage(`Benchmark recorded: ${record.id} (Backend exec: ${record.executionTimeMs} ms).`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to record benchmark'));
    }
  };

  const handleRetrieveBenchmark = async (idToFetch?: string) => {
    const id = (idToFetch ?? benchmarkIdInput).trim();
    if (!id) {
      setPersistenceError('Enter a benchmark ID to retrieve.');
      return;
    }
    try {
      setPersistenceError(null);
      setPersistenceMessage(null);
      const record = await AetherisApiClient.getBenchmark(id);
      setLastBenchmark(record);
      setBenchmarkIdInput(record.id);
      setPersistenceMessage(`Retrieved benchmark ${record.id}.`);
    } catch (err) {
      setPersistenceError(formatApiError(err, 'Failed to retrieve benchmark'));
    }
  };

  return (
    <div className="aetheris-shell">
      <header className="aetheris-header">
        <div className="badge-row">
          <span className="badge badge-gold">React 19.3.1 • OpenAPI 3.2.0</span>
          <span className={`badge ${health ? 'badge-emerald' : 'badge-rose'}`} data-testid="backend-health-badge">
            Backend: {health ? `${health.platform} (${health.engineStatus})` : 'Unavailable'}
          </span>
          {health && (
            <span
              className={`badge ${health.persistenceStatus === 'UP' ? 'badge-sky' : 'badge-gold'}`}
              data-testid="persistence-health-badge"
            >
              Persistence: {health.persistenceEngine} ({health.persistenceStatus}) • DB Connected:{' '}
              {health.databaseConnected ? 'true' : 'false'}
            </span>
          )}
        </div>

        <h1 className="aetheris-title">AETHERIS</h1>
        <p className="aetheris-subtitle">
          The Art of Algorithmic Thinking • Deterministic Cross-Platform Pathfinding &amp; Reversible Trace Workbench
        </p>

        <div className="toolbar-group" style={{ marginTop: '0.4rem', justifyContent: 'center' }}>
          <button
            type="button"
            data-testid="mode-backend-btn"
            onClick={() => setExecutionMode('BACKEND')}
            className={`btn ${executionMode === 'BACKEND' ? 'btn-active' : ''}`}
          >
            Backend API ({getApiBaseUrl()})
          </button>
          <button
            type="button"
            data-testid="mode-local-btn"
            onClick={() => setExecutionMode('LOCAL_OFFLINE')}
            className={`btn ${executionMode === 'LOCAL_OFFLINE' ? 'btn-active' : ''}`}
          >
            Offline Local Engine (Dev)
          </button>
          <input
            type="text"
            value={apiUrlInput}
            onChange={(e) => setApiUrlInput(e.target.value)}
            aria-label="Backend API base URL"
            data-testid="api-url-input"
            className="input"
            style={{ width: '210px' }}
          />
          <button type="button" onClick={handleApplyApiUrl} className="btn">
            Set API URL
          </button>
          <button type="button" onClick={refreshHealthAndPresets} data-testid="refresh-health-btn" className="btn">
            Refresh Health
          </button>
        </div>

        {executionSource && (
          <div className="badge" data-testid="execution-source-badge">
            Last Execution Source: <strong className="text-gold">{executionSource}</strong>
          </div>
        )}
      </header>

      <main className="aetheris-container">
        {healthError && executionMode === 'BACKEND' && (
          <div className="alert alert-warning" data-testid="health-error-banner">
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
          rows={currentGrid.rows}
          cols={currentGrid.cols}
          onResizeGrid={handleResizeGrid}
          onExecute={handleExecute}
          onReset={handleReset}
          onResetPlayback={resetToInitialState}
          onClearWalls={handleClearWalls}
          onClearWeights={handleClearWeights}
          onClearAll={handleClearAll}
          onLoadPreset={handleLoadTemplate}
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
          <div className="alert alert-error" data-testid="pathfinding-error-banner">
            Pathfinding Error: {error}
          </div>
        )}

        <MetricsPanel
          metrics={lastResponse?.metrics ?? null}
          algorithm={lastResponse?.algorithm ?? selectedAlgorithm}
          pathFound={lastResponse ? lastResponse.pathFound : null}
          noPathReason={lastResponse?.noPathReason}
          currentStep={currentStep}
          totalSteps={totalSteps}
          playbackSpeed={playbackSpeed}
        />

        <div className="workbench-grid-layout">
          <GridCanvas grid={grid} cellStates={cellStates} onCellInteract={handleCellInteract} />
          <TraceInspector snapshot={snapshot} />
        </div>

        {/* Backend Persistence & Benchmark Panel */}
        <section className="panel" data-testid="persistence-panel">
          <div className="toolbar-row">
            <h2 className="font-serif" style={{ fontSize: '1rem', color: '#f8fafc' }}>
              Backend Presets &amp; Benchmarks
            </h2>
            <span className="font-mono text-muted" style={{ fontSize: '0.72rem' }}>
              Persistence Adapter: {health ? `${health.persistenceEngine} (${health.persistenceStatus})` : 'Unknown'}
            </span>
          </div>

          {persistenceError && (
            <div className="alert alert-warning" data-testid="persistence-error-banner">
              Persistence Notice (Core Pathfinding Unaffected): {persistenceError}
            </div>
          )}

          {persistenceMessage && (
            <div className="alert alert-success" data-testid="persistence-success-banner">
              {persistenceMessage}
            </div>
          )}

          <div className="toolbar-row">
            <div className="toolbar-group">
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                data-testid="preset-select"
                className="select"
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
                type="button"
                data-testid="load-preset-btn"
                onClick={handleLoadBackendPreset}
                disabled={!selectedPresetId}
                className="btn"
              >
                Load
              </button>
              <button
                type="button"
                data-testid="update-preset-btn"
                onClick={handleUpdatePreset}
                disabled={!selectedPresetId}
                className="btn btn-sky"
              >
                Update
              </button>
              <button
                type="button"
                data-testid="delete-preset-btn"
                onClick={handleDeletePreset}
                disabled={!selectedPresetId}
                className="btn btn-danger"
              >
                Delete
              </button>
            </div>

            <div className="toolbar-group">
              <input
                type="text"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="Preset name"
                data-testid="preset-name-input"
                className="input"
              />
              <button type="button" data-testid="create-preset-btn" onClick={handleCreatePreset} className="btn btn-sky">
                Create Preset
              </button>
            </div>
          </div>

          {/* Portable Bundle Export / Import */}
          <div className="panel-divider" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="toolbar-group">
              <button type="button" data-testid="export-bundle-btn" onClick={handleExportPresets} className="btn">
                Export Bundle
              </button>
              <button
                type="button"
                onClick={handleDownloadBundle}
                disabled={!bundlePreview.trim()}
                className="btn"
              >
                Download .json
              </button>
              <button type="button" data-testid="import-bundle-btn" onClick={handleImportPresets} className="btn btn-active">
                Import Bundle
              </button>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Upload .json
                <input type="file" accept=".json,application/json" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
            </div>
            <textarea
              value={bundlePreview}
              onChange={(e) => setBundlePreview(e.target.value)}
              data-testid="bundle-textarea"
              placeholder="Canonical portable preset bundle JSON (export or paste to import)..."
              className="textarea"
            />
          </div>

          {/* Benchmarks */}
          <div className="panel-divider" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="toolbar-row">
              <div className="toolbar-group">
                <span className="toolbar-label">Benchmarks:</span>
                <input
                  type="text"
                  value={benchmarkNameInput}
                  onChange={(e) => setBenchmarkNameInput(e.target.value)}
                  placeholder="Optional benchmark name"
                  data-testid="benchmark-name-input"
                  className="input"
                />
                <button
                  type="button"
                  data-testid="run-benchmark-btn"
                  onClick={handleRunBenchmark}
                  className="btn btn-active"
                >
                  Run &amp; Save Benchmark
                </button>
              </div>

              <div className="toolbar-group">
                <input
                  type="text"
                  value={benchmarkIdInput}
                  onChange={(e) => setBenchmarkIdInput(e.target.value)}
                  placeholder="Benchmark ID"
                  data-testid="benchmark-id-input"
                  className="input"
                />
                <button
                  type="button"
                  data-testid="retrieve-benchmark-btn"
                  onClick={() => handleRetrieveBenchmark()}
                  className="btn"
                >
                  Retrieve by ID
                </button>
                {recentBenchmarkIds.length > 0 && (
                  <select
                    value={benchmarkIdInput}
                    onChange={(e) => {
                      setBenchmarkIdInput(e.target.value);
                      if (e.target.value) handleRetrieveBenchmark(e.target.value);
                    }}
                    className="select"
                  >
                    <option value="">Recent Benchmarks...</option>
                    {recentBenchmarkIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {lastBenchmark && (
              <div className="metrics-grid" data-testid="benchmark-result-card">
                <div className="metric-card">
                  <span className="metric-label">Benchmark ID</span>
                  <span className="metric-value text-gold" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>
                    {lastBenchmark.id}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Algorithm</span>
                  <span className="metric-value">{lastBenchmark.algorithm}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Grid Dimensions</span>
                  <span className="metric-value">
                    {lastBenchmark.gridRows}×{lastBenchmark.gridCols}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Path Found</span>
                  <span className={`metric-value ${lastBenchmark.pathFound ? 'text-emerald' : 'text-rose'}`}>
                    {lastBenchmark.pathFound ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Path Nodes / Edges</span>
                  <span className="metric-value">
                    {lastBenchmark.pathNodeCount} / {lastBenchmark.pathEdgeCount}
                  </span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Algo Path Cost</span>
                  <span className="metric-value text-gold">{lastBenchmark.algorithmPathCost ?? '—'}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Terrain Cost</span>
                  <span className="metric-value text-gold">{lastBenchmark.terrainPathCost ?? '—'}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Nodes Visited</span>
                  <span className="metric-value text-indigo">{lastBenchmark.nodesVisited}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Max Frontier</span>
                  <span className="metric-value">{lastBenchmark.maxFrontierSize}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Total Steps</span>
                  <span className="metric-value">{lastBenchmark.totalSteps}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Backend Exec Time</span>
                  <span className="metric-value text-sky">{lastBenchmark.executionTimeMs} ms</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        AETHERIS Revision 2.1.0 • Pure Determinism &amp; Full Bidirectional Trace Reversibility
      </footer>
    </div>
  );
};
