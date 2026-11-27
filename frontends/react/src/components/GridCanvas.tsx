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

    if (state?.inPath) {
      return 'cell state-in-path';
    }
    if (state?.traversalState === 'ACTIVE') {
      return 'cell state-active';
    }
    if (state?.traversalState === 'FRONTIER') {
      return 'cell state-frontier';
    }
    if (state?.traversalState === 'CLOSED') {
      return 'cell state-closed';
    }

    if (isStart) return 'cell cell-start';
    if (isTarget) return 'cell cell-target';

    const type = state?.cellType ?? 'EMPTY';
    switch (type) {
      case 'WALL':
        return 'cell cell-wall';
      case 'WEIGHTED':
        return 'cell cell-weighted';
      case 'EMPTY':
      default:
        return 'cell cell-empty';
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

  const cellSize = cols > 20 ? 24 : cols > 12 ? 32 : 44;

  return (
    <div
      className="panel grid-canvas-wrap"
      data-testid="grid-canvas"
      onMouseDown={() => setIsMouseDown(true)}
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      <div
        className="grid-matrix"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`
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
                data-testid={`cell-${id}`}
                data-cell-type={state?.cellType ?? 'EMPTY'}
                data-traversal-state={state?.traversalState ?? 'UNVISITED'}
                data-in-path={state?.inPath ? 'true' : 'false'}
                onMouseDown={() => onCellInteract(id)}
                onMouseEnter={() => {
                  if (isMouseDown) onCellInteract(id);
                }}
                className={getCellClasses(id, isStart, isTarget)}
                title={`${id} | Type: ${state?.cellType ?? 'EMPTY'} | State: ${state?.traversalState ?? 'UNVISITED'} | g: ${state?.gCost ?? '—'} | h: ${state?.hCost ?? '—'} | f: ${state?.fCost ?? '—'} | parent: ${state?.parentId ?? '—'}`}
              >
                {isStart && <span>S</span>}
                {isTarget && <span>T</span>}
                {!isStart && !isTarget && weightBadge !== null && (
                  <span style={{ fontSize: '0.62rem' }}>{weightBadge}</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="legend-row">
        <div className="legend-item">
          <div className="legend-swatch cell-start" />
          <span>Start ({grid.startNode})</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch cell-target" />
          <span>Target ({grid.targetNode})</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch cell-wall" />
          <span>Wall</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch cell-weighted" />
          <span>Weighted (2–100)</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch state-active" />
          <span>Active</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch state-frontier" />
          <span>Frontier</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch state-closed" />
          <span>Closed</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch state-in-path" />
          <span>Canonical Path</span>
        </div>
      </div>
    </div>
  );
};
