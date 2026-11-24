import React from 'react';
import { CellState, GridModel } from '../types/contract';

interface GridCanvasProps {
  grid: GridModel;
  cellStates: Map<string, CellState>;
  onCellClick?: (id: string) => void;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({ grid, cellStates, onCellClick }) => {
  const { rows, cols } = grid;

  const getCellClasses = (id: string) => {
    const state = cellStates.get(id);
    if (!state) return 'cell cell-empty';

    // Layer 3: inPath ribbon takes top visual priority
    if (state.inPath) {
      return 'cell state-in-path';
    }

    // Layer 2: Traversal dynamic state
    if (state.traversalState === 'IN_FRONTIER') {
      return 'cell state-frontier';
    }
    if (state.traversalState === 'VISITED') {
      return 'cell state-visited';
    }

    // Layer 1: Structural CellType
    switch (state.cellType) {
      case 'START':
        return 'cell cell-start';
      case 'TARGET':
        return 'cell cell-target';
      case 'WALL':
        return 'cell cell-wall';
      case 'WEIGHTED':
        return 'cell cell-weighted';
      case 'EMPTY':
      default:
        return 'cell cell-empty';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md">
      <div
        className="grid gap-1.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80"
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

            return (
              <div
                key={id}
                onClick={() => onCellClick?.(id)}
                className={`w-full h-full flex flex-col items-center justify-center cursor-pointer select-none text-[10px] font-mono font-medium ${getCellClasses(id)}`}
                title={`${id} | Type: ${state?.cellType} | State: ${state?.traversalState} | g: ${state?.gCost ?? '∞'} | f: ${state?.fCost ?? '∞'}`}
              >
                {isStart && <span className="font-bold text-white text-xs">S</span>}
                {isTarget && <span className="font-bold text-white text-xs">T</span>}
                {!isStart && !isTarget && state?.cellType === 'WEIGHTED' && (
                  <span className="text-amber-400 font-bold">5</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Layer legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-slate-300">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-400"></div>
          <span>Start (r0c0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-rose-500 border border-rose-400"></div>
          <span>Target (r4c4)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-slate-900 border border-slate-700"></div>
          <span>Wall Barrier</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-amber-600/40 border border-amber-500"></div>
          <span>Weighted Cell (Cost 5.0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-sky-400 border border-sky-300"></div>
          <span>Frontier</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-indigo-500/50 border border-indigo-400"></div>
          <span>Visited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-200"></div>
          <span>Optimal Path</span>
        </div>
      </div>
    </div>
  );
};
