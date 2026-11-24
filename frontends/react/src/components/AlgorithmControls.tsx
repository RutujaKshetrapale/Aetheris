import React from 'react';
import { AlgorithmType } from '../types/contract';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Zap } from 'lucide-react';

interface AlgorithmControlsProps {
  selectedAlgorithm: AlgorithmType;
  onSelectAlgorithm: (algo: AlgorithmType) => void;
  onExecute: () => void;
  onReset: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  currentStep: number;
  totalSteps: number;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  isLoading: boolean;
}

export const AlgorithmControls: React.FC<AlgorithmControlsProps> = ({
  selectedAlgorithm,
  onSelectAlgorithm,
  onExecute,
  onReset,
  isPlaying,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  currentStep,
  totalSteps,
  playbackSpeed,
  onSpeedChange,
  isLoading
}) => {
  const algorithms: { type: AlgorithmType; label: string; desc: string }[] = [
    { type: 'BFS', label: 'BFS', desc: 'FIFO Queue • Unweighted Shortest' },
    { type: 'DFS', label: 'DFS', desc: 'LIFO Stack • Deep Exploration' },
    { type: 'DIJKSTRA', label: 'Dijkstra', desc: 'Indexed Min-Heap • Weighted Optimal' },
    { type: 'ASTAR', label: 'A*', desc: 'Heuristic Min-Heap • Directed Optimal' }
  ];

  return (
    <div className="flex flex-col gap-4 p-5 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
      {/* Algorithm selector pills */}
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

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={onExecute}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>{isLoading ? 'Computing...' : 'Run Algorithm'}</span>
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

        {/* Reversible stepping playback bar */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
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
            disabled={totalSteps === 0 || currentStep >= totalSteps - 1}
            className="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition disabled:opacity-30"
            title={isPlaying ? 'Pause' : 'Play Trace'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={onStepForward}
            disabled={totalSteps === 0 || currentStep >= totalSteps - 1}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition disabled:opacity-30"
            title="Step Forward (Apply afterState)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <div className="text-xs font-mono text-slate-400 px-2 min-w-[70px] text-center">
            {currentStep + 1} / {totalSteps}
          </div>

          {/* Speed slider */}
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-mono">Speed</span>
            <input
              type="range"
              min="5"
              max="150"
              step="5"
              value={155 - playbackSpeed}
              onChange={(e) => onSpeedChange(155 - Number(e.target.value))}
              className="w-16 accent-amber-500 cursor-pointer"
              title={`Step interval: ${playbackSpeed}ms`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
