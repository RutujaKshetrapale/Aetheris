import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CellState, GridModel } from '../../models/contract.models';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="panel grid-canvas-wrap"
      data-testid="grid-canvas"
      (mousedown)="isMouseDown = true"
      (mouseup)="isMouseDown = false"
      (mouseleave)="isMouseDown = false"
    >
      <div
        class="grid-matrix"
        [style.gridTemplateColumns]="'repeat(' + grid.cols + ', ' + cellSize + 'px)'"
        [style.gridTemplateRows]="'repeat(' + grid.rows + ', ' + cellSize + 'px)'"
      >
        <ng-container *ngFor="let r of rowIndices">
          <ng-container *ngFor="let c of colIndices">
            <div
              [attr.data-testid]="'cell-r' + r + 'c' + c"
              [attr.data-cell-type]="getCellState('r' + r + 'c' + c)?.cellType ?? 'EMPTY'"
              [attr.data-traversal-state]="getCellState('r' + r + 'c' + c)?.traversalState ?? 'UNVISITED'"
              [attr.data-in-path]="getCellState('r' + r + 'c' + c)?.inPath ? 'true' : 'false'"
              [class]="getCellClass('r' + r + 'c' + c)"
              [title]="getCellTitle('r' + r + 'c' + c)"
              (mousedown)="onCellMouseDown('r' + r + 'c' + c)"
              (mouseenter)="onCellMouseEnter('r' + r + 'c' + c)"
            >
              <span *ngIf="'r' + r + 'c' + c === grid.startNode">S</span>
              <span *ngIf="'r' + r + 'c' + c === grid.targetNode">T</span>
              <span *ngIf="getWeightBadge('r' + r + 'c' + c) !== null" style="font-size: 0.62rem;">
                {{ getWeightBadge('r' + r + 'c' + c) }}
              </span>
            </div>
          </ng-container>
        </ng-container>
      </div>

      <div class="legend-row">
        <div class="legend-item">
          <div class="legend-swatch cell-start"></div>
          <span>Start ({{ grid.startNode }})</span>
        </div>
        <div class="legend-item">
          <div class="legend-swatch cell-target"></div>
          <span>Target ({{ grid.targetNode }})</span>
        </div>
        <div class="legend-item">
          <div class="legend-swatch cell-wall"></div>
          <span>Wall</span>
        </div>
        <div class="legend-item">
          <div class="legend-swatch cell-weighted"></div>
          <span>Weighted (2–100)</span>
        </div>
        <div class="legend-item">
          <div class="legend-swatch state-active"></div>
          <span>Active</span>
        </div>
        <div class="legend-item">
          <div class="legend-swatch state-frontier"></div>
          <span>Frontier</span>
        </div>
        <div class="legend-item">
          <div class="legend-swatch state-closed"></div>
          <span>Closed</span>
        </div>
        <div class="legend-item">
          <div class="legend-swatch state-in-path"></div>
          <span>Canonical Path</span>
        </div>
      </div>
    </div>
  `
})
export class GridComponent {
  @Input() grid!: GridModel;
  @Input() cellStates = new Map<string, CellState>();
  @Output() cellInteract = new EventEmitter<string>();

  isMouseDown = false;

  get rowIndices(): number[] {
    return Array.from({ length: this.grid.rows }, (_, i) => i);
  }

  get colIndices(): number[] {
    return Array.from({ length: this.grid.cols }, (_, i) => i);
  }

  get cellSize(): number {
    if (this.grid.cols > 20) return 24;
    if (this.grid.cols > 12) return 32;
    return 44;
  }

  onCellMouseDown(id: string): void {
    this.cellInteract.emit(id);
  }

  onCellMouseEnter(id: string): void {
    if (this.isMouseDown) {
      this.cellInteract.emit(id);
    }
  }

  getCellState(id: string): CellState | undefined {
    return this.cellStates.get(id);
  }

  getWeightBadge(id: string): number | null {
    if (id === this.grid.startNode || id === this.grid.targetNode) return null;
    const state = this.cellStates.get(id);
    if (state?.cellType === 'WEIGHTED') {
      const def = this.grid.cells?.find((c) => c.id === id);
      return def?.weight ?? 5;
    }
    return null;
  }

  getCellTitle(id: string): string {
    const state = this.cellStates.get(id);
    return `${id} | Type: ${state?.cellType ?? 'EMPTY'} | State: ${state?.traversalState ?? 'UNVISITED'} | g: ${state?.gCost ?? '—'} | h: ${state?.hCost ?? '—'} | f: ${state?.fCost ?? '—'} | parent: ${state?.parentId ?? '—'}`;
  }

  getCellClass(id: string): string {
    const state = this.cellStates.get(id);
    if (!state) return 'cell cell-empty';

    if (state.inPath) return 'cell state-in-path';
    if (state.traversalState === 'ACTIVE') return 'cell state-active';
    if (state.traversalState === 'FRONTIER') return 'cell state-frontier';
    if (state.traversalState === 'CLOSED') return 'cell state-closed';

    if (id === this.grid.startNode) return 'cell cell-start';
    if (id === this.grid.targetNode) return 'cell cell-target';

    switch (state.cellType) {
      case 'START':
        return 'cell cell-start';
      case 'TARGET':
        return 'cell cell-target';
      case 'WALL':
        return 'cell cell-wall';
      case 'WEIGHTED':
        return 'cell cell-weighted';
      default:
        return 'cell cell-empty';
    }
  }
}
