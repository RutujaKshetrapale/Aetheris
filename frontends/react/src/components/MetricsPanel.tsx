import React from 'react';
import { ExecutionMetrics } from '../types/contract';

interface MetricsPanelProps {
  metrics: ExecutionMetrics | null;
  algorithm: string;
  pathFound: boolean;
  currentStep: number;
  totalSteps: number;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  algorithm,
  pathFound,
  currentStep,
  totalSteps
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
      <div className="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Algorithm</span>
        <span className="text-sm font-serif font-bold text-amber-400 mt-1">{algorithm || 'None'}</span>
      </div>

      <div className="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Status</span>
        <span className={`text-sm font-mono font-bold mt-1 ${pathFound ? 'text-emerald-400' : 'text-slate-500'}`}>
          {pathFound ? 'PATH FOUND' : 'READY'}
        </span>
      </div>

      <div className="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Path Cost</span>
        <span className="text-sm font-mono font-bold text-slate-100 mt-1">
          {metrics ? metrics.pathCost.toFixed(1) : '—'}
        </span>
      </div>

      <div className="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Visited Nodes</span>
        <span className="text-sm font-mono font-bold text-indigo-400 mt-1">
          {metrics ? metrics.nodesVisited : '—'}
        </span>
      </div>

      <div className="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Max Frontier</span>
        <span className="text-sm font-mono font-bold text-sky-400 mt-1">
          {metrics ? metrics.maxFrontierSize : '—'}
        </span>
      </div>

      <div className="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Trace Step</span>
        <span className="text-sm font-mono font-bold text-amber-300 mt-1">
          {currentStep >= 0 ? `${currentStep + 1} / ${totalSteps}` : '0 / 0'}
        </span>
      </div>
    </div>
  );
};
