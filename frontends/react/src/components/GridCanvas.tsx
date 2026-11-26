import React, { useState } from 'react';
import { CellState, GridModel } from '../types/contract';

interface GridCanvasProps {
  grid: GridModel;
  cellStates: Map<string, CellState>;
  onCellInteract: (id: string) => void;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({ grid, cellStates, onCellInteract }) => {
  const { rows, cols } = grid;
  const [isMouseDown, setIsMouseDown] = useState(false);

  const getCellClasses = (id: string, isStart: boolean, isTarget: boolean) => {
    const state = cellStates.get(id);

    // Layer 3: inPath ribbon takes top visual priority
    if (state?.inPath) {
      return 'bg-gradient-to-br from-amber-400 to-amber-500 border-amber-200 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.8)] scale-[1.03] z-10';
    }

    // Layer 2: Traversal dynamic state (FRONTIER, ACTIVE, CLOSED)
    if (state?.traversalState === 'ACTIVE') {
      return 'bg-sky-400 border-sky-200 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.9)] scale-[1.02] z-10';
    }
    if (state?.traversalState === 'FRONTIER') {
      return 'bg-sky-950/70 border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.5)]';
    }
    if (state?.traversalState === 'CLOSED') {
      return 'bg-indigo-950/70 border-indigo-700/60 text-indigo-300';
    }

    // Layer 1: Structural CellType
    if (isStart) {
      return 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-300 text-white shadow-[0_0_14px_rgba(16,185,129,0.7)] font-bold';
    }
    if (isTarget) {
      return 'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-300 text-white shadow-[0_0_14px_rgba(244,63,94,0.7)] font-bold';
    }

    const type = state?.cellType ?? 'EMPTY';
    switch (type) {
      case 'WALL':
        return 'bg-slate-900 border-slate-950 shadow-inner text-slate-700';
      case 'WEIGHTED':
        return 'bg-amber-950/40 border-amber-600/80 text-amber-300 shadow-[inset_0_0_8px_rgba(217,119,6,0.3)]';
      case 'EMPTY':
      default:
        return 'bg-slate-950/50 border-slate-800/60 hover:border-slate-700 text-slate-600';
    }
  };

  const getWeightBadge = (id: string) => {
    const state = cellStates.get(id);
    if (state?.cellType === 'WEIGHTED') {
      const cellDef = grid.cells?.find((c) => c.id === id);
      return cellDef?.weight ?? 5;
    }
    return null;
  };

  return (
    <div
      className="flex flex-col items-center justify-center p-6 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md select-none"
      onMouseDown={() => setIsMouseDown(true)}
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      <div
        className="grid gap-1.5 p-3.5 bg-slate-950/90 rounded-xl border border-slate-800/80 shadow-2xl"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(36px, 48px))`,
          gridTemplateRows: `repeat(${rows}, minmax(36px, 48px))`
        }}
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const id = `r${r}c${c}`;
            const state = cellStates.get(id);
            const isStart = id === grid.startNode;
            const isTarget = id === grid.targetNode;
            const weightBadge = getWeightBadge(id);

            return (
              <div
                key={id}
                onMouseDown={() => onCellInteract(id)}
                onMouseEnter={() => {
                  if (isMouseDown) onCellInteract(id);
                }}
                className={`w-full h-full flex flex-col items-center justify-center cursor-pointer rounded transition-all duration-150 border text-[11px] font-mono relative ${getCellClasses(
                  id,
                  isStart,
                  isTarget
                )}`}
                title={`${id} | Type: ${state?.cellType} | State: ${state?.traversalState} | g: ${state?.gCost ?? '—'} | f: ${state?.fCost ?? '—'}`}
              >
                {isStart && <span className="font-bold text-white text-xs">S</span>}
                {isTarget && <span className="font-bold text-white text-xs">T</span>}
                {!isStart && !isTarget && weightBadge !== null && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1 rounded border border-amber-600/50">
                    {weightBadge}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Visual Hierarchy Legend */}
      <div className="flex flex-wrap items-center justify-center gap-5 mt-6 text-xs text-slate-300 font-mono">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-300"></div>
          <span>Start ({grid.startNode})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-rose-500 border border-rose-300"></div>
          <span>Target ({grid.targetNode})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-slate-900 border border-slate-950 shadow-inner"></div>
          <span>Wall (Blocked)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-amber-950/60 border border-amber-600 text-[9px] text-amber-400 flex items-center justify-center font-bold">
            W
          </div>
          <span>Weighted Cell (2–100)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-sky-950/70 border border-sky-400"></div>
          <span>Frontier</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-indigo-950/70 border border-indigo-700"></div>
          <span>Closed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-200"></div>
          <span>Canonical Path</span>
        </div>
      </div>
    </div>
  );
};
