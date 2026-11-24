import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CellState, GridModel, TraceDelta } from '../models/contract.models';

@Injectable({
  providedIn: 'root'
})
export class TracePlayerService {
  private cellStates = new Map<string, CellState>();
  private deltas: TraceDelta[] = [];
  private currentStep = -1;
  private timer: any = null;

  public cellStates$ = new BehaviorSubject<Map<string, CellState>>(new Map());
  public currentStep$ = new BehaviorSubject<number>(-1);
  public totalSteps$ = new BehaviorSubject<number>(0);
  public isPlaying$ = new BehaviorSubject<boolean>(false);
  public playbackSpeed = 30; // ms

  initGrid(grid: GridModel): void {
    this.stop();
    this.deltas = [];
    this.currentStep = -1;
    this.currentStep$.next(-1);
    this.totalSteps$.next(0);

    const map = new Map<string, CellState>();
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const id = `r${r}c${c}`;
        let type: CellState['cellType'] = 'EMPTY';
        if (id === grid.startNode) type = 'START';
        else if (id === grid.targetNode) type = 'TARGET';
        map.set(id, { cellType: type, traversalState: 'UNVISITED', inPath: false, gCost: null, fCost: null, parentId: null });
      }
    }
    if (grid.cells) {
      for (const cell of grid.cells) {
        const cur = map.get(cell.id);
        if (cur) map.set(cell.id, { ...cur, cellType: cell.cellType });
      }
    }
    this.cellStates = map;
    this.cellStates$.next(new Map(this.cellStates));
  }

  loadTrace(trace: TraceDelta[]): void {
    this.deltas = trace;
    this.currentStep = -1;
    this.currentStep$.next(-1);
    this.totalSteps$.next(trace.length);
  }

  stepForward(): boolean {
    if (this.currentStep + 1 >= this.deltas.length) {
      this.stop();
      return false;
    }
    this.currentStep++;
    const delta = this.deltas[this.currentStep];
    this.cellStates.set(delta.nodeId, delta.afterState);
    this.cellStates$.next(new Map(this.cellStates));
    this.currentStep$.next(this.currentStep);
    return true;
  }

  stepBackward(): boolean {
    if (this.currentStep < 0) return false;
    const delta = this.deltas[this.currentStep];
    this.cellStates.set(delta.nodeId, delta.beforeState);
    this.currentStep--;
    this.cellStates$.next(new Map(this.cellStates));
    this.currentStep$.next(this.currentStep);
    return true;
  }

  togglePlay(): void {
    if (this.isPlaying$.value) {
      this.stop();
    } else {
      this.start();
    }
  }

  start(): void {
    if (this.isPlaying$.value) return;
    this.isPlaying$.next(true);
    this.timer = setInterval(() => {
      const ok = this.stepForward();
      if (!ok) this.stop();
    }, this.playbackSpeed);
  }

  stop(): void {
    this.isPlaying$.next(false);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
