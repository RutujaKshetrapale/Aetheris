import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AlgorithmType, CellState, GridModel, Keyframe, TraceDelta } from '../models/contract.models';
import { ReversibleTraceEngine, TraceSnapshot } from './reversible-trace-engine';

const EMPTY_GRID: GridModel = {
  rows: 5,
  cols: 5,
  startNode: 'r0c0',
  targetNode: 'r4c4',
  cells: []
};

@Injectable({
  providedIn: 'root'
})
export class TracePlayerService implements OnDestroy {
  private engine = new ReversibleTraceEngine(EMPTY_GRID);
  private timer: ReturnType<typeof setInterval> | null = null;

  public snapshot$ = new BehaviorSubject<TraceSnapshot>(this.engine.getSnapshot());
  public cellStates$ = new BehaviorSubject<Map<string, CellState>>(this.engine.getSnapshot().cellStates);
  public currentStep$ = new BehaviorSubject<number>(-1);
  public totalSteps$ = new BehaviorSubject<number>(0);
  public isPlaying$ = new BehaviorSubject<boolean>(false);
  public playbackSpeed$ = new BehaviorSubject<number>(30);

  get playbackSpeed(): number {
    return this.playbackSpeed$.value;
  }

  set playbackSpeed(ms: number) {
    this.setPlaybackSpeed(ms);
  }

  initGrid(grid: GridModel): void {
    this.stop();
    this.engine.initGrid(grid);
    this.emitSnapshot();
  }

  loadTrace(algorithmOrTrace: AlgorithmType | TraceDelta[], traceOrKeyframes: TraceDelta[] | Keyframe[] = [], maybeKeyframes: Keyframe[] = []): void {
    this.stop();
    if (typeof algorithmOrTrace === 'string') {
      this.engine.loadTrace(algorithmOrTrace, traceOrKeyframes as TraceDelta[], maybeKeyframes);
    } else {
      this.engine.loadTrace('DIJKSTRA', algorithmOrTrace, traceOrKeyframes as Keyframe[]);
    }
    this.emitSnapshot();
  }

  resetToInitialState(): void {
    this.stop();
    this.engine.resetToInitialState();
    this.emitSnapshot();
  }

  stepForward(): boolean {
    const ok = this.engine.stepForward();
    if (!ok) {
      this.stop();
      return false;
    }
    this.emitSnapshot();
    return true;
  }

  stepBackward(): boolean {
    this.stop();
    const ok = this.engine.stepBackward();
    if (ok) {
      this.emitSnapshot();
    }
    return ok;
  }

  jumpToStep(targetStep: number): void {
    this.stop();
    this.engine.jumpToStep(targetStep);
    this.emitSnapshot();
  }

  setPlaybackSpeed(speedMs: number): void {
    const clamped = Math.max(5, Math.min(2000, Number(speedMs) || 30));
    this.playbackSpeed$.next(clamped);
    if (this.isPlaying$.value) {
      this.restartTimer();
    }
  }

  togglePlay(): void {
    if (this.isPlaying$.value) {
      this.stop();
    } else {
      if (this.engine.getCurrentStep() + 1 >= this.engine.getTotalSteps() && this.engine.getTotalSteps() > 0) {
        this.engine.resetToInitialState();
        this.emitSnapshot();
      }
      this.start();
    }
  }

  start(): void {
    if (this.isPlaying$.value || this.engine.getTotalSteps() === 0) return;
    this.isPlaying$.next(true);
    this.restartTimer();
  }

  stop(): void {
    this.isPlaying$.next(false);
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private restartTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      const ok = this.stepForward();
      if (!ok) {
        this.stop();
      }
    }, this.playbackSpeed$.value);
  }

  private emitSnapshot(): void {
    const snap = this.engine.getSnapshot();
    this.snapshot$.next(snap);
    this.cellStates$.next(snap.cellStates);
    this.currentStep$.next(snap.currentStep);
    this.totalSteps$.next(snap.totalSteps);
  }
}
