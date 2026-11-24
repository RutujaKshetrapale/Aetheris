import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CellState, GridModel } from '../../models/contract.models';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center p-6 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md">
      <div
        class="grid gap-1.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80"
        [style.gridTemplateColumns]="'repeat(' + grid.cols + ', minmax(36px, 48px))'"
        [style.gridTemplateRows]="'repeat(' + grid.rows + ', minmax(36px, 48px))'"
      >
        <ng-container *ngFor="let r of rowIndices">
          <ng-container *ngFor="let c of colIndices">
            <div
              [class]="getCellClass('r' + r + 'c' + c)"
              class="w-full h-full flex flex-col items-center justify-center cursor-pointer select-none text-[10px] font-mono font-medium"
            >
              <span *ngIf="'r' + r + 'c' + c === grid.startNode" class="font-bold text-white text-xs">S</span>
              <span *ngIf="'r' + r + 'c' + c === grid.targetNode" class="font-bold text-white text-xs">T</span>
              <span *ngIf="isWeighted('r' + r + 'c' + c)" class="text-amber-400 font-bold">5</span>
            </div>
          </ng-container>
        </ng-container>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-slate-300">
        <div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-400"></div><span>Start ({{ grid.startNode }})</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded bg-rose-500 border border-rose-400"></div><span>Target ({{ grid.targetNode }})</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded bg-slate-900 border border-slate-700"></div><span>Wall Barrier</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded bg-amber-600/40 border border-amber-500"></div><span>Weighted Cell</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded bg-sky-400 border border-sky-300"></div><span>Frontier</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded bg-indigo-500/50 border border-indigo-400"></div><span>Closed</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-200"></div><span>Optimal Path</span></div>
      </div>
    </div>
  `
})
export class GridComponent {
  @Input() grid!: GridModel;
  @Input() cellStates = new Map<string, CellState>();

  get rowIndices(): number[] {
    return Array.from({ length: this.grid.rows }, (_, i) => i);
  }

  get colIndices(): number[] {
    return Array.from({ length: this.grid.cols }, (_, i) => i);
  }

  isWeighted(id: string): boolean {
    if (id === this.grid.startNode || id === this.grid.targetNode) return false;
    return this.cellStates.get(id)?.cellType === 'WEIGHTED';
  }

  getCellClass(id: string): string {
    const state = this.cellStates.get(id);
    if (!state) return 'cell cell-empty';

    if (state.inPath) return 'cell state-in-path';
    if (state.traversalState === 'ACTIVE') return 'cell state-active';
    if (state.traversalState === 'FRONTIER') return 'cell state-frontier';
    if (state.traversalState === 'CLOSED') return 'cell state-closed';

    switch (state.cellType) {
      case 'START': return 'cell cell-start';
      case 'TARGET': return 'cell cell-target';
      case 'WALL': return 'cell cell-wall';
      case 'WEIGHTED': return 'cell cell-weighted';
      default: return 'cell cell-empty';
    }
  }
}
