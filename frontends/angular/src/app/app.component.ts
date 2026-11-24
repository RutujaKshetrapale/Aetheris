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
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1.0 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'TARGET', weight: 1.0 },
    { id: 'r1c2', row: 1, col: 2, cellType: 'WALL', weight: 1.0 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1.0 },
    { id: 'r3c2', row: 3, col: 2, cellType: 'WALL', weight: 1.0 },
    { id: 'r0c2', row: 0, col: 2, cellType: 'WEIGHTED', weight: 5.0 }
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
                [disabled]="loading"
                class="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {{ loading ? 'Computing...' : 'Run Algorithm' }}
              </button>
              <button
                (click)="onReset()"
                class="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all"
              >
                Reset
              </button>
            </div>

            <!-- Reversible playback bar -->
            <div class="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <button (click)="tracePlayer.stepBackward()" [disabled]="currentStep < 0" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs disabled:opacity-30">◀ Prev</button>
              <button (click)="tracePlayer.togglePlay()" [disabled]="totalSteps === 0 || currentStep >= totalSteps - 1" class="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded text-xs disabled:opacity-30">
                {{ isPlaying ? 'Pause' : 'Play' }}
              </button>
              <button (click)="tracePlayer.stepForward()" [disabled]="totalSteps === 0 || currentStep >= totalSteps - 1" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs disabled:opacity-30">Next ▶</button>
              <span class="text-xs font-mono text-slate-400 px-2">{{ currentStep + 1 }} / {{ totalSteps }}</span>
            </div>
          </div>
        </div>

        <!-- Grid Canvas -->
        <app-grid [grid]="grid" [cellStates]="cellStates"></app-grid>

        <!-- Metrics -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Algorithm</span>
            <span class="text-sm font-serif font-bold text-amber-400 mt-1">{{ selectedAlgorithm }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Status</span>
            <span class="text-sm font-mono font-bold mt-1" [class.text-emerald-400]="response?.pathFound">{{ response?.pathFound ? 'PATH FOUND' : 'READY' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Path Cost</span>
            <span class="text-sm font-mono font-bold text-slate-100 mt-1">{{ response?.pathCost ? response!.pathCost.toFixed(1) : '—' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Visited Nodes</span>
            <span class="text-sm font-mono font-bold text-indigo-400 mt-1">{{ response?.metrics?.nodesVisited ?? '—' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Max Frontier</span>
            <span class="text-sm font-mono font-bold text-sky-400 mt-1">{{ response?.metrics?.maxFrontierSize ?? '—' }}</span>
          </div>
          <div class="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <span class="text-[10px] uppercase font-mono tracking-wider text-slate-400">Trace Step</span>
            <span class="text-sm font-mono font-bold text-amber-300 mt-1">{{ currentStep >= 0 ? (currentStep + 1) + ' / ' + totalSteps : '0 / 0' }}</span>
          </div>
        </div>
      </main>

      <footer class="mt-12 text-center text-xs text-slate-500 font-mono">
        AETHERIS Revision 2.1.0 • 8-Configuration Cross-Platform Symmetry
      </footer>
    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  grid: GridModel = CANONICAL_GRID;
  cellStates = new Map();
  selectedAlgorithm: AlgorithmType = 'DIJKSTRA';
  response: PathfindingResponse | null = null;
  health: HealthStatus | null = null;
  loading = false;
  currentStep = -1;
  totalSteps = 0;
  isPlaying = false;

  algos: { type: AlgorithmType; label: string; desc: string }[] = [
    { type: 'BFS', label: 'BFS', desc: 'FIFO Queue • Unweighted Shortest' },
    { type: 'DFS', label: 'DFS', desc: 'LIFO Stack • Deep Exploration' },
    { type: 'DIJKSTRA', label: 'Dijkstra', desc: 'Indexed Min-Heap • Weighted Optimal' },
    { type: 'ASTAR', label: 'A*', desc: 'Heuristic Min-Heap • Directed Optimal' }
  ];

  private subs: Subscription[] = [];

  constructor(
    private api: PathfindingApiService,
    public tracePlayer: TracePlayerService
  ) {}

  ngOnInit(): void {
    this.tracePlayer.initGrid(this.grid);
    this.subs.push(
      this.tracePlayer.cellStates$.subscribe(cs => this.cellStates = cs),
      this.tracePlayer.currentStep$.subscribe(st => this.currentStep = st),
      this.tracePlayer.totalSteps$.subscribe(ts => this.totalSteps = ts),
      this.tracePlayer.isPlaying$.subscribe(p => this.isPlaying = p)
    );
    this.api.getHealth().subscribe({
      next: h => this.health = h,
      error: () => {}
    });
  }

  onExecute(): void {
    this.loading = true;
    this.api.findPath({
      algorithm: this.selectedAlgorithm,
      grid: this.grid
    }).subscribe({
      next: res => {
        this.response = res;
        this.tracePlayer.loadTrace(res.traceDeltas);
        this.tracePlayer.start();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onReset(): void {
    this.tracePlayer.initGrid(this.grid);
    this.response = null;
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
