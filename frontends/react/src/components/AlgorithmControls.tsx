import React from 'react';
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
  Sparkles
} from 'lucide-react';

export type ToolType = 'WALL' | 'WEIGHTED' | 'START' | 'TARGET' | 'ERASER';

interface AlgorithmControlsProps {
  selectedAlgorithm: AlgorithmType;
  onSelectAlgorithm: (algo: AlgorithmType) => void;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  weightValue: number;
  onWeightChange: (val: number) => void;
  onExecute: () => void;
  onReset: () => void;
  onClearWalls: () => void;
  onClearWeights: () => void;
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
  onExecute,
  onReset,
  onClearWalls,
  onClearWeights,
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
  const algorithms: { type: AlgorithmType; label: string; desc: string }[] = [
    { type: 'BFS', label: 'BFS', desc: 'FIFO Queue • Shortest Hops' },
    { type: 'DFS', label: 'DFS', desc: 'LIFO Stack • Deterministic' },
    { type: 'DIJKSTRA', label: 'Dijkstra', desc: 'Min-Heap • Optimal Terrain' },
    { type: 'ASTAR', label: 'A*', desc: 'f = g + h • Guided Search' }
  ];

  const tools: { type: ToolType; label: string; icon: React.ReactNode }[] = [
    { type: 'WALL', label: 'Wall', icon: <Square className="w-3.5 h-3.5 fill-current" /> },
    { type: 'WEIGHTED', label: 'Weight', icon: <Flame className="w-3.5 h-3.5" /> },
    { type: 'START', label: 'Start', icon: <MapPin className="w-3.5 h-3.5 text-emerald-400" /> },
    { type: 'TARGET', label: 'Target', icon: <Flag className="w-3.5 h-3.5 text-rose-400" /> },
    { type: 'ERASER', label: 'Eraser', icon: <Eraser className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="flex flex-col gap-4 p-5 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
      {/* 1. Algorithm Selection Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {algorithms.map((algo) => {
          const isSelected = selectedAlgorithm === algo.type;
          return (
            <button
              key={algo.type}
              onClick={() => onSelectAlgorithm(algo.type)}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500/80 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <span className={`text-sm font-bold ${isSelected ? 'text-amber-400 font-serif' : 'text-slate-200'}`}>
                {algo.label}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">{algo.desc}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Grid Editing Tools & Benchmarks */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mr-1.5">
            Editing Tool:
          </span>
          {tools.map((t) => {
            const isActive = activeTool === t.type;
            return (
              <button
                key={t.type}
                onClick={() => onSelectTool(t.type)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                  isActive
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}

          {activeTool === 'WEIGHTED' && (
            <div className="flex items-center gap-1 ml-2 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-[10px] text-amber-400 font-mono">Weight:</span>
              {[2, 5, 15, 50].map((w) => (
                <button
                  key={w}
                  onClick={() => onWeightChange(w)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                    weightValue === w ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onLoadPreset('canonical')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono border border-slate-800"
            title="Load Canonical 5x5 Benchmark"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>5x5 Benchmark</span>
          </button>
          <button
            onClick={() => onLoadPreset('divergence')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono border border-slate-800"
            title="Load Divergence Grid"
          >
            <span>Divergence Grid</span>
          </button>
          <button
            onClick={onClearWalls}
            className="flex items-center gap-1 px-2 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-rose-300 rounded-lg text-xs font-mono border border-slate-800"
            title="Clear Walls"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Walls</span>
          </button>
          <button
            onClick={onClearWeights}
            className="flex items-center gap-1 px-2 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded-lg text-xs font-mono border border-slate-800"
            title="Clear Weights"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Weights</span>
          </button>
        </div>
      </div>

      {/* 3. Execution & Reversible Playback Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={onExecute}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg shadow-md shadow-amber-500/10 transition-all active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{isLoading ? 'Computing...' : 'Run Pathfinding'}</span>
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all active:scale-95"
            title="Reset Grid"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Reversible Timeline Playback Controls */}
        <div className="flex flex-1 items-center gap-3 bg-slate-950/90 px-4 py-2 rounded-xl border border-slate-800/90 max-w-lg">
          <button
            onClick={onStepBackward}
            disabled={currentStep < 0}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition disabled:opacity-30"
            title="Step Backward (Apply beforeState)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            disabled={totalSteps === 0}
            className="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition disabled:opacity-30"
            title={isPlaying ? 'Pause' : 'Play Trace Animation'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={onStepForward}
            disabled={currentStep + 1 >= totalSteps}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition disabled:opacity-30"
            title="Step Forward (Apply afterState)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Timeline Scrubber */}
          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              min={-1}
              max={Math.max(0, totalSteps - 1)}
              value={currentStep}
              onChange={(e) => onScrub(Number(e.target.value))}
              disabled={totalSteps === 0}
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-30"
            />
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap min-w-[55px] text-right">
              {currentStep >= 0 ? `${currentStep + 1}/${totalSteps}` : `0/${totalSteps}`}
            </span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            {[100, 40, 15].map((spd, idx) => {
              const labels = ['1x', '2x', '5x'];
              return (
                <button
                  key={spd}
                  onClick={() => onSpeedChange(spd)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                    playbackSpeed === spd
                      ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/50'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {labels[idx]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
