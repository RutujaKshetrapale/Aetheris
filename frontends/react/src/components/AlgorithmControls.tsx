import React, { useState, useEffect } from 'react';
import { AlgorithmType } from '../types/contract';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Zap,
  Square,
  Flame,
  MapPin,
  Flag,
  Eraser,
  Trash2,
  Sparkles,
  ChevronsLeft
} from 'lucide-react';

export type ToolType = 'WALL' | 'WEIGHTED' | 'START' | 'TARGET' | 'ERASER';

interface AlgorithmControlsProps {
  selectedAlgorithm: AlgorithmType;
  onSelectAlgorithm: (algo: AlgorithmType) => void;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  weightValue: number;
  onWeightChange: (val: number) => void;
  rows: number;
  cols: number;
  onResizeGrid: (rows: number, cols: number) => void;
  onExecute: () => void;
  onReset: () => void;
  onResetPlayback: () => void;
  onClearWalls: () => void;
  onClearWeights: () => void;
  onClearAll: () => void;
  onLoadPreset: (name: 'canonical' | 'divergence' | 'large') => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onScrub: (step: number) => void;
  currentStep: number;
  totalSteps: number;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  isLoading: boolean;
}

export const AlgorithmControls: React.FC<AlgorithmControlsProps> = ({
  selectedAlgorithm,
  onSelectAlgorithm,
  activeTool,
  onSelectTool,
  weightValue,
  onWeightChange,
  rows,
  cols,
  onResizeGrid,
  onExecute,
  onReset,
  onResetPlayback,
  onClearWalls,
  onClearWeights,
  onClearAll,
  onLoadPreset,
  isPlaying,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  onScrub,
  currentStep,
  totalSteps,
  playbackSpeed,
  onSpeedChange,
  isLoading
}) => {
  const [draftRows, setDraftRows] = useState<number>(rows);
  const [draftCols, setDraftCols] = useState<number>(cols);

  useEffect(() => {
    setDraftRows(rows);
    setDraftCols(cols);
  }, [rows, cols]);

  const algorithms: { type: AlgorithmType; label: string; desc: string }[] = [
    { type: 'BFS', label: 'BFS', desc: 'FIFO Queue • Shortest Hops' },
    { type: 'DFS', label: 'DFS', desc: 'LIFO Stack • Deterministic' },
    { type: 'DIJKSTRA', label: 'Dijkstra', desc: 'Indexed Min-Heap • Weighted Optimal' },
    { type: 'ASTAR', label: 'A*', desc: 'f = g + h • Manhattan Guided' }
  ];

  const tools: { type: ToolType; label: string; icon: React.ReactNode }[] = [
    { type: 'WALL', label: 'Wall', icon: <Square className="w-3.5 h-3.5" /> },
    { type: 'WEIGHTED', label: 'Weight', icon: <Flame className="w-3.5 h-3.5" /> },
    { type: 'START', label: 'Start', icon: <MapPin className="w-3.5 h-3.5 text-emerald" /> },
    { type: 'TARGET', label: 'Target', icon: <Flag className="w-3.5 h-3.5 text-rose" /> },
    { type: 'ERASER', label: 'Eraser', icon: <Eraser className="w-3.5 h-3.5" /> }
  ];

  const handleApplyDimensions = () => {
    const r = Math.max(2, Math.min(50, Math.floor(draftRows || 5)));
    const c = Math.max(2, Math.min(50, Math.floor(draftCols || 5)));
    setDraftRows(r);
    setDraftCols(c);
    onResizeGrid(r, c);
  };

  return (
    <section className="panel" data-testid="algorithm-controls">
      {/* 1. Algorithm Selection Cards */}
      <div className="algo-grid">
        {algorithms.map((algo) => {
          const isSelected = selectedAlgorithm === algo.type;
          return (
            <button
              key={algo.type}
              type="button"
              data-testid={`algo-${algo.type}`}
              onClick={() => onSelectAlgorithm(algo.type)}
              className={`algo-card ${isSelected ? 'active' : ''}`}
            >
              <span className="algo-card-title">{algo.label}</span>
              <span className="algo-card-desc">{algo.desc}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Grid Editing Tools, Dimensions & Quick Templates */}
      <div className="toolbar-row panel-divider">
        <div className="toolbar-group">
          <span className="toolbar-label">Tool:</span>
          {tools.map((t) => (
            <button
              key={t.type}
              type="button"
              data-testid={`tool-${t.type}`}
              onClick={() => onSelectTool(t.type)}
              className={`btn ${activeTool === t.type ? 'btn-active' : ''}`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}

          {activeTool === 'WEIGHTED' && (
            <div className="toolbar-group" style={{ marginLeft: '0.4rem' }}>
              <span className="toolbar-label text-gold">Weight:</span>
              {[2, 5, 15, 50].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onWeightChange(w)}
                  className={`btn ${weightValue === w ? 'btn-active' : ''}`}
                  style={{ padding: '0.25rem 0.5rem' }}
                >
                  {w}
                </button>
              ))}
              <input
                type="number"
                min={2}
                max={100}
                value={weightValue}
                onChange={(e) => {
                  const val = Math.max(2, Math.min(100, Number(e.target.value) || 2));
                  onWeightChange(val);
                }}
                aria-label="Custom cell weight"
                className="input input-sm"
              />
            </div>
          )}
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Size:</span>
          <input
            type="number"
            min={2}
            max={50}
            value={draftRows}
            onChange={(e) => setDraftRows(Number(e.target.value))}
            aria-label="Grid rows"
            data-testid="grid-rows-input"
            className="input input-sm"
          />
          <span className="text-muted font-mono">×</span>
          <input
            type="number"
            min={2}
            max={50}
            value={draftCols}
            onChange={(e) => setDraftCols(Number(e.target.value))}
            aria-label="Grid columns"
            data-testid="grid-cols-input"
            className="input input-sm"
          />
          <button type="button" onClick={handleApplyDimensions} data-testid="apply-grid-size" className="btn">
            Resize
          </button>
        </div>
      </div>

      <div className="toolbar-row">
        <div className="toolbar-group">
          <span className="toolbar-label">Templates:</span>
          <button type="button" onClick={() => onLoadPreset('canonical')} className="btn">
            <Sparkles className="w-3 h-3 text-gold" />
            <span>5×5 Canonical</span>
          </button>
          <button type="button" onClick={() => onLoadPreset('divergence')} className="btn">
            <span>3×4 Divergence</span>
          </button>
          <button type="button" onClick={() => onLoadPreset('large')} className="btn">
            <span>8×8 Maze</span>
          </button>
        </div>

        <div className="toolbar-group">
          <button type="button" onClick={onClearWalls} className="btn">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Walls</span>
          </button>
          <button type="button" onClick={onClearWeights} className="btn">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Weights</span>
          </button>
          <button type="button" onClick={onClearAll} className="btn btn-danger">
            <span>Clear Grid</span>
          </button>
        </div>
      </div>

      {/* 3. Execution & Reversible Playback Bar */}
      <div className="toolbar-row panel-divider">
        <div className="toolbar-group">
          <button
            type="button"
            data-testid="run-algorithm-btn"
            onClick={onExecute}
            disabled={isLoading}
            className="btn btn-primary"
          >
            <Zap className="w-4 h-4" />
            <span>{isLoading ? 'Computing...' : 'Run Pathfinding'}</span>
          </button>

          <button type="button" data-testid="reset-grid-btn" onClick={onReset} className="btn">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Trace</span>
          </button>
        </div>

        <div className="playback-bar">
          <button
            type="button"
            data-testid="playback-reset-btn"
            onClick={onResetPlayback}
            disabled={totalSteps === 0}
            className="btn"
            title="Seek to initial state (-1)"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid="playback-back-btn"
            onClick={onStepBackward}
            disabled={currentStep < 0}
            className="btn"
            title="Step Backward"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid="playback-play-btn"
            onClick={onTogglePlay}
            disabled={totalSteps === 0}
            className="btn btn-active"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            data-testid="playback-forward-btn"
            onClick={onStepForward}
            disabled={currentStep + 1 >= totalSteps}
            className="btn"
            title="Step Forward"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <input
            type="range"
            data-testid="playback-scrubber"
            min={-1}
            max={Math.max(0, totalSteps - 1)}
            value={currentStep}
            onChange={(e) => onScrub(Number(e.target.value))}
            disabled={totalSteps === 0}
            aria-label="Trace step scrubber"
            className="scrubber"
          />

          <span className="font-mono text-muted" data-testid="playback-step-label" style={{ fontSize: '0.72rem', minWidth: '64px', textAlign: 'right' }}>
            {currentStep >= 0 ? `${currentStep + 1}/${totalSteps}` : `0/${totalSteps}`}
          </span>

          <select
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            aria-label="Playback speed"
            data-testid="playback-speed-select"
            className="select"
          >
            <option value={10}>10 ms/step</option>
            <option value={30}>30 ms/step</option>
            <option value={80}>80 ms/step</option>
            <option value={200}>200 ms/step</option>
            <option value={500}>500 ms/step</option>
          </select>
        </div>
      </div>
    </section>
  );
};
