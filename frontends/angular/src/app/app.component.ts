import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AlgorithmType, GridModel, HealthStatus, PathfindingResponse } from './models/contract.models';
import { PathfindingApiService } from './services/pathfinding-api.service';
import { TracePlayerService } from './services/trace-player.service';
import { GridComponent } from './components/grid/grid.component';

const CANONICAL_GRID: GridModel = {
  rows: 5,
  cols: 5,
  startNode: 'r0c0',
  targetNode: 'r4c4',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'TARGET', weight: 1 },
    { id: 'r1c2', row: 1, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r3c2', row: 3, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r0c2', row: 0, col: 2, cellType: 'WEIGHTED', weight: 5 }
  ]
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, GridComponent],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
      <header class="max-w-4xl w-full flex flex-col items-center text-center mb-8">
        <div class="flex items-center gap-3">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
            Frontend: Angular 19 • Canonical OpenAPI 3.2.0
          </span>
          <span *ngIf="health" class="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Backend: {{ health.platform }} ({{ health.persistenceEngine }})
          </span>
        </div>
        <h1 class="text-3xl sm:text-4xl font-bold font-serif text-slate-100 mt-3 tracking-wide">
          AETHERIS
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl font-light">
          The Art of Algorithmic Thinking • Deterministic Cross-Platform Pathfinding & Reversible Trace Exploration
        </p>
      </header>

      <main class="max-w-4xl w-full flex flex-col gap-6">
        <!-- Algorithm selection and controls -->
        <div class="flex flex-col gap-4 p-5 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <button
              *ngFor="let algo of algos"
              (click)="selectedAlgorithm = algo.type"
              [class]="selectedAlgorithm === algo.type ? 'bg-amber-500/15 border-amber-500/80 shadow-lg shadow-amber-500/10' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'"
              class="flex flex-col items-start p-3 rounded-xl border text-left transition-all"
            >
              <span class="text-sm font-bold font-serif" [class.text-amber-400]="selectedAlgorithm === algo.type">{{ algo.label }}</span>
              <span class="text-[11px] text-slate-400 mt-0.5">{{ algo.desc }}</span>
            </button>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div class="flex items-center gap-2">
              <button
                (click)="onExecute()"
                [disabled]="isLoading"
                class="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {{ isLoading ? 'Computing...' : 'Run Algorithm' }}
              </button>
              <button
                (click)="onReset()"
                class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all"
              >
                Reset
              </button>
            </div>

            <div class="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <button (click)="tracePlayer.stepBackward()" class="px-2 py-1 hover:bg-slate-800 text-slate-300 rounded text-xs">Step Back</button>
              <button (click)="tracePlayer.togglePlay()" class="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold text-xs">
                {{ (tracePlayer.isPlaying$ | async) ? 'Pause' : 'Play' }}
              </button>
              <button (click)="tracePlayer.stepForward()" class="px-2 py-1 hover:bg-slate-800 text-slate-300 rounded text-xs">Step Forward</button>
            </div>
          </div>
        </div>

        <!-- Metrics Panel -->
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Algorithm</span>
            <span class="text-sm font-serif font-bold text-amber-400 mt-1">{{ selectedAlgorithm }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Status</span>
            <span class="text-sm font-mono font-bold mt-1 text-emerald-400">
              {{ lastResponse?.pathFound ? 'PATH FOUND' : (lastResponse ? 'NO PATH' : 'READY') }}
            </span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Path Nodes</span>
            <span class="text-sm font-mono font-bold text-slate-100 mt-1">{{ lastResponse?.pathNodeCount ?? '—' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Path Edges</span>
            <span class="text-sm font-mono font-bold text-slate-100 mt-1">{{ lastResponse?.pathEdgeCount ?? '—' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Algo Cost</span>
            <span class="text-sm font-mono font-bold text-amber-300 mt-1">{{ lastResponse?.algorithmPathCost ?? '—' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Terrain Cost</span>
            <span class="text-sm font-mono font-bold text-amber-400 mt-1">{{ lastResponse?.terrainPathCost ?? '—' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Visited</span>
            <span class="text-sm font-mono font-bold text-indigo-400 mt-1">{{ lastResponse?.metrics?.nodesVisited ?? '—' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Trace Step</span>
            <span class="text-sm font-mono font-bold text-sky-400 mt-1">
              {{ (tracePlayer.currentStep$ | async)! >= 0 ? ((tracePlayer.currentStep$ | async)! + 1) + ' / ' + (tracePlayer.totalSteps$ | async) : '0 / 0' }}
            </span>
          </div>
        </div>

        <app-grid [grid]="canonicalGrid" [cellStates]="(tracePlayer.cellStates$ | async)!"></app-grid>
      </main>
    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  canonicalGrid = CANONICAL_GRID;
  selectedAlgorithm: AlgorithmType = 'DIJKSTRA';
  lastResponse: PathfindingResponse | null = null;
  health: HealthStatus | null = null;
  isLoading = false;

  algos: { type: AlgorithmType; label: string; desc: string }[] = [
    { type: 'BFS', label: 'BFS', desc: 'FIFO Queue • Unweighted Shortest' },
    { type: 'DFS', label: 'DFS', desc: 'LIFO Stack • Deep Exploration' },
    { type: 'DIJKSTRA', label: 'Dijkstra', desc: 'Indexed Min-Heap • Weighted Optimal' },
    { type: 'ASTAR', label: 'A*', desc: 'Heuristic Min-Heap • Directed Optimal' }
  ];

  constructor(
    public tracePlayer: TracePlayerService,
    private api: PathfindingApiService
  ) {}

  ngOnInit(): void {
    this.tracePlayer.initGrid(this.canonicalGrid);
    this.api.getHealth().subscribe({
      next: (h) => (this.health = h),
      error: () => console.warn('Backend not currently reachable')
    });
  }

  ngOnDestroy(): void {
    this.tracePlayer.stop();
  }

  onExecute(): void {
    this.isLoading = true;
    this.api.tracePath({ algorithm: this.selectedAlgorithm, grid: this.canonicalGrid }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.lastResponse = res;
        this.tracePlayer.loadTrace(res.traceDeltas, res.keyframes || []);
        this.tracePlayer.start();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Execution failed:', err);
      }
    });
  }

  onReset(): void {
    this.tracePlayer.initGrid(this.canonicalGrid);
    this.lastResponse = null;
  }
}
