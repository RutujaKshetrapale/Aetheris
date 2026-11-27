import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  AlgorithmType,
  BenchmarkRecord,
  CellDefinition,
  GridModel,
  GridPreset,
  HealthStatus,
  PathfindingResponse
} from './models/contract.models';
import { PathfindingApiService, formatHttpError } from './services/pathfinding-api.service';
import { LocalEngineService } from './services/local-engine.service';
import { TracePlayerService } from './services/trace-player.service';
import { TraceSnapshot } from './services/reversible-trace-engine';
import { GridComponent } from './components/grid/grid.component';

type ToolType = 'WALL' | 'WEIGHTED' | 'START' | 'TARGET' | 'ERASER';
type ExecutionMode = 'BACKEND' | 'LOCAL_OFFLINE';

const BENCHMARK_HISTORY_KEY = 'aetheris.angular.benchmarkIds';

const CANONICAL_5X5: GridModel = {
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

const DIVERGENCE_3X4: GridModel = {
  rows: 3,
  cols: 4,
  startNode: 'r0c0',
  targetNode: 'r0c3',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r0c3', row: 0, col: 3, cellType: 'TARGET', weight: 1 },
    { id: 'r0c1', row: 0, col: 1, cellType: 'WEIGHTED', weight: 50 },
    { id: 'r0c2', row: 0, col: 2, cellType: 'WEIGHTED', weight: 50 }
  ]
};

const LARGE_8X8: GridModel = {
  rows: 8,
  cols: 8,
  startNode: 'r0c0',
  targetNode: 'r7c7',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r7c7', row: 7, col: 7, cellType: 'TARGET', weight: 1 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r3c2', row: 3, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r4c2', row: 4, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r4c3', row: 4, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'WALL', weight: 1 },
    { id: 'r2c5', row: 2, col: 5, cellType: 'WEIGHTED', weight: 15 },
    { id: 'r3c5', row: 3, col: 5, cellType: 'WEIGHTED', weight: 15 }
  ]
};

function parseNodeCoords(id: string): { row: number; col: number } {
  const parts = id.slice(1).split('c');
  return { row: parseInt(parts[0], 10), col: parseInt(parts[1], 10) };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, GridComponent],
  template: `
    <div class="aetheris-shell">
      <header class="aetheris-header">
        <div class="badge-row">
          <span class="badge badge-gold">Angular 22.3.0 • OpenAPI 3.2.0</span>
          <span class="badge" [ngClass]="health ? 'badge-emerald' : 'badge-rose'" data-testid="backend-health-badge">
            Backend: {{ health ? health.platform + ' (' + health.engineStatus + ')' : 'Unavailable' }}
          </span>
          <span
            *ngIf="health"
            class="badge"
            [ngClass]="health.persistenceStatus === 'UP' ? 'badge-sky' : 'badge-gold'"
            data-testid="persistence-health-badge"
          >
            Persistence: {{ health.persistenceEngine }} ({{ health.persistenceStatus }}) • DB Connected:
            {{ health.databaseConnected ? 'true' : 'false' }}
          </span>
        </div>

        <h1 class="aetheris-title">AETHERIS</h1>
        <p class="aetheris-subtitle">
          The Art of Algorithmic Thinking • Deterministic Cross-Platform Pathfinding &amp; Reversible Trace Workbench
        </p>

        <div class="toolbar-group" style="margin-top: 0.4rem; justify-content: center;">
          <button
            type="button"
            data-testid="mode-backend-btn"
            (click)="executionMode = 'BACKEND'"
            class="btn"
            [class.btn-active]="executionMode === 'BACKEND'"
          >
            Backend API ({{ api.getApiBaseUrl() }})
          </button>
          <button
            type="button"
            data-testid="mode-local-btn"
            (click)="executionMode = 'LOCAL_OFFLINE'"
            class="btn"
            [class.btn-active]="executionMode === 'LOCAL_OFFLINE'"
          >
            Offline Local Engine (Dev)
          </button>
          <input
            type="text"
            [(ngModel)]="apiUrlInput"
            aria-label="Backend API base URL"
            data-testid="api-url-input"
            class="input"
            style="width: 210px;"
          />
          <button type="button" (click)="applyApiUrl()" class="btn">Set API URL</button>
          <button type="button" (click)="refreshHealthAndPresets()" data-testid="refresh-health-btn" class="btn">
            Refresh Health
          </button>
        </div>

        <div *ngIf="executionSource" class="badge" data-testid="execution-source-badge">
          Last Execution Source: <strong class="text-gold">{{ executionSource }}</strong>
        </div>
      </header>

      <main class="aetheris-container">
        <div *ngIf="healthError && executionMode === 'BACKEND'" class="alert alert-warning" data-testid="health-error-banner">
          Health Notice: {{ healthError }}
        </div>

        <!-- Controls Panel -->
        <section class="panel" data-testid="algorithm-controls">
          <div class="algo-grid">
            <button
              *ngFor="let algo of algos"
              type="button"
              [attr.data-testid]="'algo-' + algo.type"
              (click)="selectedAlgorithm = algo.type"
              class="algo-card"
              [class.active]="selectedAlgorithm === algo.type"
            >
              <span class="algo-card-title">{{ algo.label }}</span>
              <span class="algo-card-desc">{{ algo.desc }}</span>
            </button>
          </div>

          <div class="toolbar-row panel-divider">
            <div class="toolbar-group">
              <span class="toolbar-label">Tool:</span>
              <button
                *ngFor="let t of tools"
                type="button"
                [attr.data-testid]="'tool-' + t.type"
                (click)="activeTool = t.type"
                class="btn"
                [class.btn-active]="activeTool === t.type"
              >
                {{ t.label }}
              </button>

              <div *ngIf="activeTool === 'WEIGHTED'" class="toolbar-group" style="margin-left: 0.4rem;">
                <span class="toolbar-label text-gold">Weight:</span>
                <button
                  *ngFor="let w of quickWeights"
                  type="button"
                  (click)="weightValue = w"
                  class="btn"
                  [class.btn-active]="weightValue === w"
                  style="padding: 0.25rem 0.5rem;"
                >
                  {{ w }}
                </button>
                <input
                  type="number"
                  min="2"
                  max="100"
                  [(ngModel)]="weightValue"
                  (ngModelChange)="clampWeight()"
                  aria-label="Custom cell weight"
                  class="input input-sm"
                />
              </div>
            </div>

            <div class="toolbar-group">
              <span class="toolbar-label">Size:</span>
              <input
                type="number"
                min="2"
                max="50"
                [(ngModel)]="draftRows"
                aria-label="Grid rows"
                data-testid="grid-rows-input"
                class="input input-sm"
              />
              <span class="text-muted font-mono">×</span>
              <input
                type="number"
                min="2"
                max="50"
                [(ngModel)]="draftCols"
                aria-label="Grid columns"
                data-testid="grid-cols-input"
                class="input input-sm"
              />
              <button type="button" (click)="applyDimensions()" data-testid="apply-grid-size" class="btn">
                Resize
              </button>
            </div>
          </div>

          <div class="toolbar-row">
            <div class="toolbar-group">
              <span class="toolbar-label">Templates:</span>
              <button type="button" (click)="loadTemplate('canonical')" class="btn">5×5 Canonical</button>
              <button type="button" (click)="loadTemplate('divergence')" class="btn">3×4 Divergence</button>
              <button type="button" (click)="loadTemplate('large')" class="btn">8×8 Maze</button>
            </div>

            <div class="toolbar-group">
              <button type="button" (click)="clearWalls()" class="btn">Clear Walls</button>
              <button type="button" (click)="clearWeights()" class="btn">Clear Weights</button>
              <button type="button" (click)="clearAll()" class="btn btn-danger">Clear Grid</button>
            </div>
          </div>

          <div class="toolbar-row panel-divider">
            <div class="toolbar-group">
              <button
                type="button"
                data-testid="run-algorithm-btn"
                (click)="onExecute()"
                [disabled]="isLoading"
                class="btn btn-primary"
              >
                {{ isLoading ? 'Computing...' : 'Run Pathfinding' }}
              </button>
              <button type="button" data-testid="reset-grid-btn" (click)="onReset()" class="btn">
                Reset Trace
              </button>
            </div>

            <div class="playback-bar">
              <button
                type="button"
                data-testid="playback-reset-btn"
                (click)="tracePlayer.resetToInitialState()"
                [disabled]="snapshot.totalSteps === 0"
                class="btn"
                title="Seek to initial state (-1)"
              >
                &laquo;
              </button>
              <button
                type="button"
                data-testid="playback-back-btn"
                (click)="tracePlayer.stepBackward()"
                [disabled]="snapshot.currentStep < 0"
                class="btn"
              >
                Step Back
              </button>
              <button
                type="button"
                data-testid="playback-play-btn"
                (click)="tracePlayer.togglePlay()"
                [disabled]="snapshot.totalSteps === 0"
                class="btn btn-active"
              >
                {{ (tracePlayer.isPlaying$ | async) ? 'Pause' : 'Play' }}
              </button>
              <button
                type="button"
                data-testid="playback-forward-btn"
                (click)="tracePlayer.stepForward()"
                [disabled]="snapshot.currentStep + 1 >= snapshot.totalSteps"
                class="btn"
              >
                Step Forward
              </button>

              <input
                type="range"
                data-testid="playback-scrubber"
                [min]="-1"
                [max]="snapshot.totalSteps > 0 ? snapshot.totalSteps - 1 : 0"
                [ngModel]="snapshot.currentStep"
                (ngModelChange)="tracePlayer.jumpToStep($event)"
                [disabled]="snapshot.totalSteps === 0"
                aria-label="Trace step scrubber"
                class="scrubber"
              />

              <span class="font-mono text-muted" data-testid="playback-step-label" style="font-size: 0.72rem; min-width: 64px; text-align: right;">
                {{ snapshot.currentStep >= 0 ? (snapshot.currentStep + 1) + '/' + snapshot.totalSteps : '0/' + snapshot.totalSteps }}
              </span>

              <select
                [ngModel]="tracePlayer.playbackSpeed$ | async"
                (ngModelChange)="tracePlayer.setPlaybackSpeed($event)"
                aria-label="Playback speed"
                data-testid="playback-speed-select"
                class="select"
              >
                <option [ngValue]="10">10 ms/step</option>
                <option [ngValue]="30">30 ms/step</option>
                <option [ngValue]="80">80 ms/step</option>
                <option [ngValue]="200">200 ms/step</option>
                <option [ngValue]="500">500 ms/step</option>
              </select>
            </div>
          </div>
        </section>

        <div *ngIf="error" class="alert alert-error" data-testid="pathfinding-error-banner">
          Pathfinding Error: {{ error }}
        </div>

        <!-- Metrics Panel -->
        <section class="metrics-grid" data-testid="metrics-panel">
          <div class="metric-card">
            <span class="metric-label">Algorithm</span>
            <span class="metric-value text-gold">{{ lastResponse?.algorithm || selectedAlgorithm }}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Status</span>
            <span
              class="metric-value"
              data-testid="metric-status"
              [ngClass]="!lastResponse ? 'text-muted' : lastResponse.pathFound ? 'text-emerald' : 'text-rose'"
              style="font-size: 0.78rem;"
            >
              {{ !lastResponse ? 'READY' : lastResponse.pathFound ? 'PATH FOUND' : 'NO PATH' + (lastResponse.noPathReason ? ' (' + lastResponse.noPathReason + ')' : '') }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Path Nodes</span>
            <span class="metric-value" data-testid="metric-path-nodes">{{ lastResponse?.pathNodeCount ?? '—' }}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Path Edges</span>
            <span class="metric-value">{{ lastResponse?.pathEdgeCount ?? '—' }}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Algo Path Cost</span>
            <span class="metric-value text-gold" data-testid="metric-algo-cost">{{ lastResponse?.algorithmPathCost ?? '—' }}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Terrain Cost</span>
            <span class="metric-value text-gold" data-testid="metric-terrain-cost">{{ lastResponse?.terrainPathCost ?? '—' }}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Visited Nodes</span>
            <span class="metric-value text-indigo">{{ lastResponse?.metrics?.nodesVisited ?? '—' }}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Max Frontier</span>
            <span class="metric-value">{{ lastResponse?.metrics?.maxFrontierSize ?? '—' }}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Backend Exec Time</span>
            <span class="metric-value text-sky">
              {{ lastResponse ? lastResponse.metrics.executionTimeMs + ' ms' : '—' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Frontend Playback</span>
            <span class="metric-value text-muted" style="font-size: 0.78rem;">
              {{ snapshot.currentStep >= 0 ? (snapshot.currentStep + 1) + '/' + snapshot.totalSteps : '0/' + snapshot.totalSteps }}
              @ {{ tracePlayer.playbackSpeed$ | async }}ms
            </span>
          </div>
        </section>

        <!-- Grid & Reversible Trace Inspector -->
        <div class="workbench-grid-layout">
          <app-grid
            [grid]="currentGrid"
            [cellStates]="snapshot.cellStates"
            (cellInteract)="onCellInteract($event)"
          ></app-grid>

          <aside class="panel" data-testid="trace-inspector">
            <div class="toolbar-row">
              <h2 class="font-serif" style="font-size: 0.95rem; color: #f8fafc;">Reversible Trace State</h2>
              <span class="badge badge-gold">
                Step {{ snapshot.currentStep >= 0 ? snapshot.currentStep + 1 : 0 }} / {{ snapshot.totalSteps }}
              </span>
            </div>

            <div class="metrics-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
              <div class="metric-card">
                <span class="metric-label">Current Action</span>
                <span class="metric-value text-gold" style="font-size: 0.78rem;">
                  {{ snapshot.currentAction ?? 'INITIAL_GRID' }}{{ snapshot.currentOperationSubtype ? ' (' + snapshot.currentOperationSubtype + ')' : '' }}
                </span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Active Node</span>
                <span class="metric-value text-sky" style="font-size: 0.78rem;">
                  {{ snapshot.activeNode ?? '—' }}
                </span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Visited / Closed</span>
                <span class="metric-value text-indigo" style="font-size: 0.78rem;">
                  {{ snapshot.nodesVisited }} / {{ snapshot.closedNodes.size }}
                </span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Frontier / Max</span>
                <span class="metric-value" style="font-size: 0.78rem;">
                  {{ snapshot.frontier.length }} / {{ snapshot.maxFrontierSize }}
                </span>
              </div>
            </div>

            <div *ngIf="snapshot.currentDetails" class="chip" style="width: 100%; padding: 0.45rem 0.6rem;">
              {{ snapshot.currentDetails }}
            </div>

            <div class="panel-divider">
              <div class="toolbar-label" style="margin-bottom: 0.4rem;">
                {{ isHeapAlgo ? 'Physical Indexed Min-Heap Frontier' : 'Physical Frontier' }} ({{ snapshot.frontier.length }})
              </div>
              <div class="inspector-list">
                <span *ngIf="snapshot.frontier.length === 0" class="text-muted font-mono" style="font-size: 0.72rem;">
                  Empty
                </span>
                <span *ngFor="let id of snapshot.frontier; let idx = index" class="chip chip-sky">
                  {{ isHeapAlgo ? '[' + (snapshot.heapIndexMap.get(id) ?? idx) + '] ' + id : id }}
                  <ng-container *ngIf="isHeapAlgo && snapshot.heapPriorities.get(id) as prio">
                    (g:{{ prio.g ?? '—' }} f:{{ prio.f ?? '—' }})
                  </ng-container>
                </span>
              </div>
            </div>

            <div *ngIf="snapshot.lastHeapSwaps.length > 0" class="panel-divider">
              <div class="toolbar-label" style="margin-bottom: 0.4rem;">
                Physical Heap Swaps ({{ snapshot.lastHeapSwaps.length }})
              </div>
              <div class="inspector-list">
                <span *ngFor="let s of snapshot.lastHeapSwaps" class="chip chip-gold">
                  [{{ s.indexA }}:{{ s.nodeA }}] &#8644; [{{ s.indexB }}:{{ s.nodeB }}]
                </span>
              </div>
            </div>

            <div *ngIf="snapshot.path.length > 0" class="panel-divider">
              <div class="toolbar-label" style="margin-bottom: 0.4rem;">
                Reconstructed Path ({{ snapshot.path.length }} nodes)
              </div>
              <div class="inspector-list">
                <span *ngFor="let id of snapshot.path" class="chip chip-gold">{{ id }}</span>
              </div>
            </div>
          </aside>
        </div>

        <!-- Backend Presets & Benchmarks -->
        <section class="panel" data-testid="persistence-panel">
          <div class="toolbar-row">
            <h2 class="font-serif" style="font-size: 1rem; color: #f8fafc;">Backend Presets &amp; Benchmarks</h2>
            <span class="font-mono text-muted" style="font-size: 0.72rem;">
              Persistence Adapter: {{ health ? health.persistenceEngine + ' (' + health.persistenceStatus + ')' : 'Unknown' }}
            </span>
          </div>

          <div *ngIf="persistenceError" class="alert alert-warning" data-testid="persistence-error-banner">
            Persistence Notice (Core Pathfinding Unaffected): {{ persistenceError }}
          </div>

          <div *ngIf="persistenceMessage" class="alert alert-success" data-testid="persistence-success-banner">
            {{ persistenceMessage }}
          </div>

          <div class="toolbar-row">
            <div class="toolbar-group">
              <select [(ngModel)]="selectedPresetId" data-testid="preset-select" class="select">
                <option *ngIf="presets.length === 0" value="">No persisted presets</option>
                <option *ngFor="let p of presets" [value]="p.id">{{ p.name }} ({{ p.id }})</option>
              </select>
              <button
                type="button"
                data-testid="load-preset-btn"
                (click)="onLoadBackendPreset()"
                [disabled]="!selectedPresetId"
                class="btn"
              >
                Load
              </button>
              <button
                type="button"
                data-testid="update-preset-btn"
                (click)="onUpdatePreset()"
                [disabled]="!selectedPresetId"
                class="btn btn-sky"
              >
                Update
              </button>
              <button
                type="button"
                data-testid="delete-preset-btn"
                (click)="onDeletePreset()"
                [disabled]="!selectedPresetId"
                class="btn btn-danger"
              >
                Delete
              </button>
            </div>

            <div class="toolbar-group">
              <input
                type="text"
                [(ngModel)]="presetNameInput"
                placeholder="Preset name"
                data-testid="preset-name-input"
                class="input"
              />
              <button type="button" data-testid="create-preset-btn" (click)="onCreatePreset()" class="btn btn-sky">
                Create Preset
              </button>
            </div>
          </div>

          <div class="panel-divider" style="display: flex; flex-direction: column; gap: 0.6rem;">
            <div class="toolbar-group">
              <button type="button" data-testid="export-bundle-btn" (click)="onExportPresets()" class="btn">
                Export Bundle
              </button>
              <button
                type="button"
                (click)="onDownloadBundle()"
                [disabled]="!bundlePreview.trim()"
                class="btn"
              >
                Download .json
              </button>
              <button type="button" data-testid="import-bundle-btn" (click)="onImportPresets()" class="btn btn-active">
                Import Bundle
              </button>
              <label class="btn" style="cursor: pointer;">
                Upload .json
                <input type="file" accept=".json,application/json" (change)="onImportFile($event)" style="display: none;" />
              </label>
            </div>
            <textarea
              [(ngModel)]="bundlePreview"
              data-testid="bundle-textarea"
              placeholder="Canonical portable preset bundle JSON (export or paste to import)..."
              class="textarea"
            ></textarea>
          </div>

          <div class="panel-divider" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div class="toolbar-row">
              <div class="toolbar-group">
                <span class="toolbar-label">Benchmarks:</span>
                <input
                  type="text"
                  [(ngModel)]="benchmarkNameInput"
                  placeholder="Optional benchmark name"
                  data-testid="benchmark-name-input"
                  class="input"
                />
                <button
                  type="button"
                  data-testid="run-benchmark-btn"
                  (click)="onRunBenchmark()"
                  class="btn btn-active"
                >
                  Run &amp; Save Benchmark
                </button>
              </div>

              <div class="toolbar-group">
                <input
                  type="text"
                  [(ngModel)]="benchmarkIdInput"
                  placeholder="Benchmark ID"
                  data-testid="benchmark-id-input"
                  class="input"
                />
                <button
                  type="button"
                  data-testid="retrieve-benchmark-btn"
                  (click)="onRetrieveBenchmark()"
                  class="btn"
                >
                  Retrieve by ID
                </button>
                <select
                  *ngIf="recentBenchmarkIds.length > 0"
                  [ngModel]="benchmarkIdInput"
                  (ngModelChange)="onSelectRecentBenchmark($event)"
                  class="select"
                >
                  <option value="">Recent Benchmarks...</option>
                  <option *ngFor="let id of recentBenchmarkIds" [value]="id">{{ id }}</option>
                </select>
              </div>
            </div>

            <div *ngIf="lastBenchmark" class="metrics-grid" data-testid="benchmark-result-card">
              <div class="metric-card">
                <span class="metric-label">Benchmark ID</span>
                <span class="metric-value text-gold" style="font-size: 0.72rem; word-break: break-all;">
                  {{ lastBenchmark.id }}
                </span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Algorithm</span>
                <span class="metric-value">{{ lastBenchmark.algorithm }}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Grid Dimensions</span>
                <span class="metric-value">{{ lastBenchmark.gridRows }}×{{ lastBenchmark.gridCols }}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Path Found</span>
                <span class="metric-value" [ngClass]="lastBenchmark.pathFound ? 'text-emerald' : 'text-rose'">
                  {{ lastBenchmark.pathFound ? 'YES' : 'NO' }}
                </span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Path Nodes / Edges</span>
                <span class="metric-value">{{ lastBenchmark.pathNodeCount }} / {{ lastBenchmark.pathEdgeCount }}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Algo Path Cost</span>
                <span class="metric-value text-gold">{{ lastBenchmark.algorithmPathCost ?? '—' }}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Terrain Cost</span>
                <span class="metric-value text-gold">{{ lastBenchmark.terrainPathCost ?? '—' }}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Nodes Visited</span>
                <span class="metric-value text-indigo">{{ lastBenchmark.nodesVisited }}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Max Frontier</span>
                <span class="metric-value">{{ lastBenchmark.maxFrontierSize }}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Total Steps</span>
                <span class="metric-value">{{ lastBenchmark.totalSteps }}</span>
              </div>
              <div class="metric-card">
                <span class="metric-label">Backend Exec Time</span>
                <span class="metric-value text-sky">{{ lastBenchmark.executionTimeMs }} ms</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer class="footer">
        AETHERIS Revision 2.1.0 • Pure Determinism &amp; Full Bidirectional Trace Reversibility
      </footer>
    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  currentGrid: GridModel = CANONICAL_5X5;
  draftRows = CANONICAL_5X5.rows;
  draftCols = CANONICAL_5X5.cols;
  selectedAlgorithm: AlgorithmType = 'DIJKSTRA';
  activeTool: ToolType = 'WALL';
  weightValue = 5;
  quickWeights = [2, 5, 15, 50];
  executionMode: ExecutionMode = 'BACKEND';
  apiUrlInput = '';
  executionSource: string | null = null;
  lastResponse: PathfindingResponse | null = null;

  health: HealthStatus | null = null;
  healthError: string | null = null;
  isLoading = false;
  error: string | null = null;

  presets: GridPreset[] = [];
  selectedPresetId = '';
  presetNameInput = 'Custom Grid Preset';
  persistenceError: string | null = null;
  persistenceMessage: string | null = null;
  bundlePreview = '';

  benchmarkNameInput = '';
  benchmarkIdInput = '';
  lastBenchmark: BenchmarkRecord | null = null;
  recentBenchmarkIds: string[] = [];

  snapshot!: TraceSnapshot;
  private subs = new Subscription();

  algos: { type: AlgorithmType; label: string; desc: string }[] = [
    { type: 'BFS', label: 'BFS', desc: 'FIFO Queue • Shortest Hops' },
    { type: 'DFS', label: 'DFS', desc: 'LIFO Stack • Deterministic' },
    { type: 'DIJKSTRA', label: 'Dijkstra', desc: 'Indexed Min-Heap • Weighted Optimal' },
    { type: 'ASTAR', label: 'A*', desc: 'f = g + h • Manhattan Guided' }
  ];

  tools: { type: ToolType; label: string }[] = [
    { type: 'WALL', label: 'Wall' },
    { type: 'WEIGHTED', label: 'Weight' },
    { type: 'START', label: 'Start' },
    { type: 'TARGET', label: 'Target' },
    { type: 'ERASER', label: 'Eraser' }
  ];

  constructor(
    public tracePlayer: TracePlayerService,
    public api: PathfindingApiService,
    private localEngine: LocalEngineService
  ) {
    this.apiUrlInput = this.api.getApiBaseUrl();
    try {
      const raw = localStorage.getItem(BENCHMARK_HISTORY_KEY);
      if (raw) this.recentBenchmarkIds = JSON.parse(raw) as string[];
    } catch {
      this.recentBenchmarkIds = [];
    }
  }

  get isHeapAlgo(): boolean {
    return this.snapshot.algorithm === 'DIJKSTRA' || this.snapshot.algorithm === 'ASTAR';
  }

  ngOnInit(): void {
    this.subs.add(
      this.tracePlayer.snapshot$.subscribe((snap) => {
        this.snapshot = snap;
      })
    );
    this.tracePlayer.initGrid(this.currentGrid);
    this.refreshHealthAndPresets();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.tracePlayer.stop();
  }

  applyApiUrl(): void {
    this.api.setApiBaseUrl(this.apiUrlInput);
    this.apiUrlInput = this.api.getApiBaseUrl();
    this.refreshHealthAndPresets();
  }

  refreshHealthAndPresets(): void {
    this.subs.add(
      this.api.getHealth().subscribe({
        next: (h) => {
          this.health = h;
          this.healthError = null;
          this.loadPresetsList();
        },
        error: (err) => {
          this.health = null;
          this.healthError = formatHttpError(err, this.api.getApiBaseUrl(), 'Health check failed');
          this.presets = [];
        }
      })
    );
  }

  private loadPresetsList(): void {
    this.subs.add(
      this.api.getPresets().subscribe({
        next: (list) => {
          this.presets = list;
          this.persistenceError = null;
          if (!this.selectedPresetId || !list.some((p) => p.id === this.selectedPresetId)) {
            this.selectedPresetId = list[0]?.id || '';
          }
        },
        error: (err) => {
          this.presets = [];
          this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to load presets');
        }
      })
    );
  }

  private updateGridModel(newGrid: GridModel): void {
    this.currentGrid = newGrid;
    this.draftRows = newGrid.rows;
    this.draftCols = newGrid.cols;
    this.tracePlayer.initGrid(newGrid);
    this.lastResponse = null;
    this.executionSource = null;
    this.error = null;
  }

  clampWeight(): void {
    this.weightValue = Math.max(2, Math.min(100, Math.floor(this.weightValue || 2)));
  }

  applyDimensions(): void {
    const newRows = Math.max(2, Math.min(50, Math.floor(this.draftRows || 5)));
    const newCols = Math.max(2, Math.min(50, Math.floor(this.draftCols || 5)));
    const startCoords = parseNodeCoords(this.currentGrid.startNode);
    const targetCoords = parseNodeCoords(this.currentGrid.targetNode);

    let nextStart = `r${Math.min(startCoords.row, newRows - 1)}c${Math.min(startCoords.col, newCols - 1)}`;
    let nextTarget = `r${Math.min(targetCoords.row, newRows - 1)}c${Math.min(targetCoords.col, newCols - 1)}`;
    if (nextStart === nextTarget) {
      nextTarget = `r${newRows - 1}c${newCols - 1}`;
      if (nextStart === nextTarget) nextStart = 'r0c0';
    }

    const keptCells = (this.currentGrid.cells || []).filter((cell) => {
      if (cell.row >= newRows || cell.col >= newCols) return false;
      if (cell.id === nextStart || cell.id === nextTarget) return false;
      return cell.cellType === 'WALL' || cell.cellType === 'WEIGHTED';
    });

    const s = parseNodeCoords(nextStart);
    const t = parseNodeCoords(nextTarget);
    this.updateGridModel({
      rows: newRows,
      cols: newCols,
      startNode: nextStart,
      targetNode: nextTarget,
      cells: [
        { id: nextStart, row: s.row, col: s.col, cellType: 'START', weight: 1 },
        { id: nextTarget, row: t.row, col: t.col, cellType: 'TARGET', weight: 1 },
        ...keptCells
      ]
    });
  }

  onCellInteract(id: string): void {
    const { row: r, col: c } = parseNodeCoords(id);

    if (this.activeTool === 'START') {
      if (id === this.currentGrid.targetNode) return;
      const nextCells = (this.currentGrid.cells || []).filter(
        (cell) => cell.id !== id && cell.id !== this.currentGrid.startNode
      );
      nextCells.push({ id, row: r, col: c, cellType: 'START', weight: 1 });
      this.updateGridModel({ ...this.currentGrid, startNode: id, cells: nextCells });
      return;
    }

    if (this.activeTool === 'TARGET') {
      if (id === this.currentGrid.startNode) return;
      const nextCells = (this.currentGrid.cells || []).filter(
        (cell) => cell.id !== id && cell.id !== this.currentGrid.targetNode
      );
      nextCells.push({ id, row: r, col: c, cellType: 'TARGET', weight: 1 });
      this.updateGridModel({ ...this.currentGrid, targetNode: id, cells: nextCells });
      return;
    }

    if (id === this.currentGrid.startNode || id === this.currentGrid.targetNode) return;

    const existingCells = [...(this.currentGrid.cells || [])];
    const cellIdx = existingCells.findIndex((cell) => cell.id === id);

    if (this.activeTool === 'WALL') {
      if (cellIdx >= 0 && existingCells[cellIdx].cellType === 'WALL') {
        existingCells.splice(cellIdx, 1);
      } else {
        const newDef: CellDefinition = { id, row: r, col: c, cellType: 'WALL', weight: 1 };
        if (cellIdx >= 0) existingCells[cellIdx] = newDef;
        else existingCells.push(newDef);
      }
    } else if (this.activeTool === 'WEIGHTED') {
      this.clampWeight();
      const newDef: CellDefinition = { id, row: r, col: c, cellType: 'WEIGHTED', weight: this.weightValue };
      if (cellIdx >= 0) existingCells[cellIdx] = newDef;
      else existingCells.push(newDef);
    } else if (this.activeTool === 'ERASER') {
      if (cellIdx >= 0) existingCells.splice(cellIdx, 1);
    }

    this.updateGridModel({ ...this.currentGrid, cells: existingCells });
  }

  clearWalls(): void {
    const filtered = (this.currentGrid.cells || []).filter((cell) => cell.cellType !== 'WALL');
    this.updateGridModel({ ...this.currentGrid, cells: filtered });
  }

  clearWeights(): void {
    const filtered = (this.currentGrid.cells || []).filter((cell) => cell.cellType !== 'WEIGHTED');
    this.updateGridModel({ ...this.currentGrid, cells: filtered });
  }

  clearAll(): void {
    const s = parseNodeCoords(this.currentGrid.startNode);
    const t = parseNodeCoords(this.currentGrid.targetNode);
    this.updateGridModel({
      ...this.currentGrid,
      cells: [
        { id: this.currentGrid.startNode, row: s.row, col: s.col, cellType: 'START', weight: 1 },
        { id: this.currentGrid.targetNode, row: t.row, col: t.col, cellType: 'TARGET', weight: 1 }
      ]
    });
  }

  loadTemplate(name: 'canonical' | 'divergence' | 'large'): void {
    if (name === 'canonical') this.updateGridModel(CANONICAL_5X5);
    else if (name === 'divergence') this.updateGridModel(DIVERGENCE_3X4);
    else this.updateGridModel(LARGE_8X8);
  }

  onExecute(): void {
    this.isLoading = true;
    this.error = null;

    if (this.executionMode === 'LOCAL_OFFLINE') {
      const res = this.localEngine.execute({ algorithm: this.selectedAlgorithm, grid: this.currentGrid });
      this.isLoading = false;
      this.lastResponse = res;
      this.executionSource = 'Offline Local Engine (Explicit Dev Mode)';
      this.tracePlayer.loadTrace(res.algorithm, res.traceDeltas, res.keyframes || []);
      this.tracePlayer.start();
      return;
    }

    this.subs.add(
      this.api.tracePath({ algorithm: this.selectedAlgorithm, grid: this.currentGrid }).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.lastResponse = res;
          this.executionSource = this.health
            ? `Backend API • ${this.health.platform}`
            : `Backend API (${this.api.getApiBaseUrl()})`;
          this.tracePlayer.loadTrace(res.algorithm, res.traceDeltas, res.keyframes || []);
          this.tracePlayer.start();
        },
        error: (err) => {
          this.isLoading = false;
          this.lastResponse = null;
          this.executionSource = null;
          this.error = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to execute pathfinding');
        }
      })
    );
  }

  onReset(): void {
    this.updateGridModel(this.currentGrid);
  }

  onLoadBackendPreset(): void {
    if (!this.selectedPresetId) return;
    this.persistenceError = null;
    this.persistenceMessage = null;
    this.subs.add(
      this.api.getPreset(this.selectedPresetId).subscribe({
        next: (preset) => {
          this.presetNameInput = preset.name;
          this.updateGridModel(preset.grid);
          this.persistenceMessage = `Loaded preset "${preset.name}" (${preset.id}).`;
        },
        error: (err) => {
          this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to load preset');
        }
      })
    );
  }

  onCreatePreset(): void {
    this.persistenceError = null;
    this.persistenceMessage = null;
    this.subs.add(
      this.api
        .createPreset({
          name: this.presetNameInput.trim() || 'Custom Grid Preset',
          description: `Saved from Angular workbench (${this.currentGrid.rows}x${this.currentGrid.cols})`,
          grid: this.currentGrid
        })
        .subscribe({
          next: (created) => {
            this.presets = [...this.presets, created];
            this.selectedPresetId = created.id;
            this.persistenceMessage = `Created preset "${created.name}" (${created.id}).`;
          },
          error: (err) => {
            this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to create preset');
          }
        })
    );
  }

  onUpdatePreset(): void {
    if (!this.selectedPresetId) return;
    this.persistenceError = null;
    this.persistenceMessage = null;
    this.subs.add(
      this.api
        .updatePreset(this.selectedPresetId, {
          id: this.selectedPresetId,
          name: this.presetNameInput.trim() || 'Updated Grid Preset',
          description: `Updated from Angular workbench (${this.currentGrid.rows}x${this.currentGrid.cols})`,
          grid: this.currentGrid
        })
        .subscribe({
          next: (updated) => {
            this.presets = this.presets.map((p) => (p.id === updated.id ? updated : p));
            this.persistenceMessage = `Updated preset "${updated.name}" (${updated.id}).`;
          },
          error: (err) => {
            this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to update preset');
          }
        })
    );
  }

  onDeletePreset(): void {
    if (!this.selectedPresetId) return;
    const targetId = this.selectedPresetId;
    this.persistenceError = null;
    this.persistenceMessage = null;
    this.subs.add(
      this.api.deletePreset(targetId).subscribe({
        next: () => {
          this.presets = this.presets.filter((p) => p.id !== targetId);
          this.selectedPresetId = this.presets[0]?.id || '';
          this.persistenceMessage = `Deleted preset ${targetId}.`;
        },
        error: (err) => {
          this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to delete preset');
        }
      })
    );
  }

  onExportPresets(): void {
    this.persistenceError = null;
    this.persistenceMessage = null;
    this.subs.add(
      this.api.exportPresets().subscribe({
        next: (bundle) => {
          this.bundlePreview = bundle;
          this.persistenceMessage = 'Exported canonical portable preset bundle.';
        },
        error: (err) => {
          this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to export presets');
        }
      })
    );
  }

  onDownloadBundle(): void {
    if (!this.bundlePreview.trim()) return;
    const blob = new Blob([this.bundlePreview], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aetheris-presets.bundle.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.bundlePreview = await file.text();
    input.value = '';
  }

  onImportPresets(): void {
    if (!this.bundlePreview.trim()) {
      this.persistenceError = 'Paste or upload a canonical preset bundle JSON before importing.';
      return;
    }
    this.persistenceError = null;
    this.persistenceMessage = null;
    this.subs.add(
      this.api.importPresets(this.bundlePreview).subscribe({
        next: (res) => {
          this.persistenceMessage = `Imported ${res.importedCount} preset(s) from bundle.`;
          this.loadPresetsList();
        },
        error: (err) => {
          this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to import preset bundle');
        }
      })
    );
  }

  onRunBenchmark(): void {
    this.persistenceError = null;
    this.persistenceMessage = null;
    this.subs.add(
      this.api
        .runBenchmark({
          name: this.benchmarkNameInput.trim() || `${this.selectedAlgorithm} ${this.currentGrid.rows}x${this.currentGrid.cols}`,
          algorithm: this.selectedAlgorithm,
          grid: this.currentGrid
        })
        .subscribe({
          next: (record) => {
            this.lastBenchmark = record;
            this.benchmarkIdInput = record.id;
            const nextIds = [record.id, ...this.recentBenchmarkIds.filter((id) => id !== record.id)].slice(0, 10);
            this.recentBenchmarkIds = nextIds;
            try {
              localStorage.setItem(BENCHMARK_HISTORY_KEY, JSON.stringify(nextIds));
            } catch {
              // ignore storage quota errors
            }
            this.persistenceMessage = `Benchmark recorded: ${record.id} (Backend exec: ${record.executionTimeMs} ms).`;
          },
          error: (err) => {
            this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to record benchmark');
          }
        })
    );
  }

  onSelectRecentBenchmark(id: string): void {
    this.benchmarkIdInput = id;
    if (id) this.onRetrieveBenchmark(id);
  }

  onRetrieveBenchmark(idOverride?: string): void {
    const id = (idOverride ?? this.benchmarkIdInput).trim();
    if (!id) {
      this.persistenceError = 'Enter a benchmark ID to retrieve.';
      return;
    }
    this.persistenceError = null;
    this.persistenceMessage = null;
    this.subs.add(
      this.api.getBenchmark(id).subscribe({
        next: (record) => {
          this.lastBenchmark = record;
          this.benchmarkIdInput = record.id;
          this.persistenceMessage = `Retrieved benchmark ${record.id}.`;
        },
        error: (err) => {
          this.persistenceError = formatHttpError(err, this.api.getApiBaseUrl(), 'Failed to retrieve benchmark');
        }
      })
    );
  }
}
