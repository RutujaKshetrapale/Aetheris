import {
  AlgorithmType,
  CellState,
  GridModel,
  HeapSwap,
  Keyframe,
  TraceAction,
  TraceDelta
} from '../types/contract';

export interface HeapPriority {
  g: number | null | undefined;
  h: number | null | undefined;
  f: number | null | undefined;
}

export interface TraceSnapshot {
  currentStep: number;
  totalSteps: number;
  algorithm: AlgorithmType;
  cellStates: Map<string, CellState>;
  activeNode: string | null;
  frontier: string[];
  closedNodes: Set<string>;
  heapIndexMap: Map<string, number>;
  heapPriorities: Map<string, HeapPriority>;
  lastHeapSwaps: HeapSwap[];
  path: string[];
  nodesVisited: number;
  maxFrontierSize: number;
  currentAction: TraceAction | null;
  currentOperationSubtype: string | null;
  currentNodeId: string | null;
  currentDetails: string | null;
}

function buildInitialCellStates(grid: GridModel): Map<string, CellState> {
  const map = new Map<string, CellState>();
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const id = `r${r}c${c}`;
      let type: CellState['cellType'] = 'EMPTY';
      if (id === grid.targetNode) type = 'TARGET';
      if (id === grid.startNode) type = 'START';
      map.set(id, {
        cellType: type,
        traversalState: 'UNVISITED',
        inPath: false,
        gCost: null,
        hCost: null,
        fCost: null,
        parentId: null
      });
    }
  }
  if (grid.cells) {
    for (const cell of grid.cells) {
      const cur = map.get(cell.id);
      if (cur) {
        map.set(cell.id, { ...cur, cellType: cell.cellType });
      }
    }
  }
  return map;
}

interface DequeuedHeapInfo {
  root: string;
  last: string | null;
}

/**
 * Canonical reversible trace playback engine matching the AETHERIS fixture runner.
 * Supports O(1) forward/backward stepping and keyframe-accelerated seeking.
 */
export class ReversibleTraceEngine {
  private grid: GridModel;
  private algorithm: AlgorithmType = 'DIJKSTRA';
  private deltas: TraceDelta[] = [];
  private keyframes: Keyframe[] = [];
  private currentStep = -1;

  private cellStates = new Map<string, CellState>();
  private activeNode: string | null = null;
  private frontier: string[] = [];
  private closedNodes = new Set<string>();
  private heapIndexMap = new Map<string, number>();
  private heapPriorities = new Map<string, HeapPriority>();
  private lastHeapSwaps: HeapSwap[] = [];
  private path: string[] = [];
  private nodesVisited = 0;
  private maxFrontierSize = 0;
  private currentAction: TraceAction | null = null;
  private currentOperationSubtype: string | null = null;
  private currentNodeId: string | null = null;
  private currentDetails: string | null = null;

  // Reversible undo history stacks
  private activeNodeHistory: (string | null)[] = [];
  private dequeuedHistory: (string | DequeuedHeapInfo | undefined)[] = [];
  private maxFrontierHistory: number[] = [];
  private pathHistory: string[][] = [];
  private historyBaseStep = 0;

  constructor(initialGrid: GridModel) {
    this.grid = initialGrid;
    this.resetPlaybackState();
  }

  public initGrid(grid: GridModel): void {
    this.grid = grid;
    this.deltas = [];
    this.keyframes = [];
    this.resetPlaybackState();
  }

  public loadTrace(algorithm: AlgorithmType, deltas: TraceDelta[], keyframes: Keyframe[] = []): void {
    this.algorithm = algorithm;
    this.deltas = deltas;
    this.keyframes = [...keyframes].sort((a, b) => a.step - b.step);
    this.resetPlaybackState();
  }

  public resetToInitialState(): void {
    this.resetPlaybackState();
  }

  private resetPlaybackState(): void {
    this.currentStep = -1;
    this.cellStates = buildInitialCellStates(this.grid);
    this.activeNode = null;
    this.frontier = [];
    this.closedNodes = new Set();
    this.heapIndexMap = new Map();
    this.heapPriorities = new Map();
    this.lastHeapSwaps = [];
    this.path = [];
    this.nodesVisited = 0;
    this.maxFrontierSize = 0;
    this.currentAction = null;
    this.currentOperationSubtype = null;
    this.currentNodeId = null;
    this.currentDetails = null;
    this.activeNodeHistory = [];
    this.dequeuedHistory = [];
    this.maxFrontierHistory = [];
    this.pathHistory = [];
    this.historyBaseStep = 0;
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  public getTotalSteps(): number {
    return this.deltas.length;
  }

  public getGrid(): GridModel {
    return this.grid;
  }

  public getSnapshot(): TraceSnapshot {
    return {
      currentStep: this.currentStep,
      totalSteps: this.deltas.length,
      algorithm: this.algorithm,
      cellStates: new Map(this.cellStates),
      activeNode: this.activeNode,
      frontier: [...this.frontier],
      closedNodes: new Set(this.closedNodes),
      heapIndexMap: new Map(this.heapIndexMap),
      heapPriorities: new Map(this.heapPriorities),
      lastHeapSwaps: [...this.lastHeapSwaps],
      path: [...this.path],
      nodesVisited: this.nodesVisited,
      maxFrontierSize: this.maxFrontierSize,
      currentAction: this.currentAction,
      currentOperationSubtype: this.currentOperationSubtype,
      currentNodeId: this.currentNodeId,
      currentDetails: this.currentDetails
    };
  }

  public stepForward(): boolean {
    if (this.currentStep + 1 >= this.deltas.length) {
      return false;
    }
    this.currentStep++;
    const delta = this.deltas[this.currentStep];
    this.applyForward(delta);
    return true;
  }

  public stepBackward(): boolean {
    if (this.currentStep < 0) {
      return false;
    }
    if (this.currentStep < this.historyBaseStep) {
      this.jumpToStep(this.currentStep - 1);
      return true;
    }
    const delta = this.deltas[this.currentStep];
    this.applyInverse(delta);
    this.currentStep--;
    this.syncCurrentStepMetadata();
    return true;
  }

  public jumpToStep(targetStep: number): void {
    if (targetStep < -1 || targetStep >= this.deltas.length) return;
    if (targetStep === -1) {
      this.resetPlaybackState();
      return;
    }

    let bestKeyframe: Keyframe | null = null;
    for (const kf of this.keyframes) {
      if (kf.step <= targetStep && (bestKeyframe === null || kf.step > bestKeyframe.step)) {
        bestKeyframe = kf;
      }
    }

    this.resetPlaybackState();
    let startStep = 0;

    if (bestKeyframe) {
      const nextStates = new Map<string, CellState>();
      for (const [id, cs] of Object.entries(bestKeyframe.cellStates)) {
        nextStates.set(id, { ...cs });
      }
      this.cellStates = nextStates;
      this.frontier = [...bestKeyframe.frontier];
      this.activeNode = bestKeyframe.activeNode ?? null;

      this.closedNodes = new Set<string>();
      for (const [id, cs] of nextStates.entries()) {
        if (cs.traversalState === 'CLOSED') {
          this.closedNodes.add(id);
        }
      }

      if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
        this.frontier.forEach((id, idx) => {
          this.heapIndexMap.set(id, idx);
          const cs = nextStates.get(id);
          if (cs) {
            this.heapPriorities.set(id, {
              g: cs.gCost,
              h: cs.hCost,
              f: cs.fCost
            });
          }
        });
      }

      // Compute scalar counters up to keyframe step without mutating cellStates
      let visited = 0;
      let maxFrontier = 0;
      const builtPath: string[] = [];
      for (let i = 0; i <= bestKeyframe.step; i++) {
        const d = this.deltas[i];
        if (d.action === 'EXAMINE_NODE') visited++;
        if (d.frontierSize > maxFrontier) maxFrontier = d.frontierSize;
        if (d.action === 'PATH_FOUND' && d.nodeId) builtPath.push(d.nodeId);
        if (d.action === 'NO_PATH_FOUND') builtPath.length = 0;
      }
      this.nodesVisited = visited;
      this.maxFrontierSize = maxFrontier;
      this.path = builtPath;

      startStep = bestKeyframe.step + 1;
      this.historyBaseStep = startStep;
    }

    for (let i = startStep; i <= targetStep; i++) {
      this.applyForward(this.deltas[i]);
    }
    this.currentStep = targetStep;
    this.syncCurrentStepMetadata();
  }

  private syncCurrentStepMetadata(): void {
    if (this.currentStep < 0 || this.currentStep >= this.deltas.length) {
      this.currentAction = null;
      this.currentOperationSubtype = null;
      this.currentNodeId = null;
      this.currentDetails = null;
      this.lastHeapSwaps = [];
      return;
    }
    const delta = this.deltas[this.currentStep];
    this.currentAction = delta.action;
    this.currentOperationSubtype = delta.operationSubtype ?? null;
    this.currentNodeId = delta.nodeId ?? null;
    this.currentDetails = delta.details ?? null;
    this.lastHeapSwaps = delta.heapSwaps ? [...delta.heapSwaps] : [];
  }

  private applyForward(delta: TraceDelta): void {
    this.currentAction = delta.action;
    this.currentOperationSubtype = delta.operationSubtype ?? null;
    this.currentNodeId = delta.nodeId ?? null;
    this.currentDetails = delta.details ?? null;
    this.lastHeapSwaps = delta.heapSwaps ? [...delta.heapSwaps] : [];
    this.maxFrontierHistory.push(this.maxFrontierSize);

    if (delta.nodeId && delta.afterState) {
      this.cellStates.set(delta.nodeId, { ...delta.afterState });
    }

    switch (delta.action) {
      case 'INITIALIZE':
        if (delta.nodeId && delta.frontierSize > 0) {
          this.frontier.push(delta.nodeId);
          if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
            this.heapIndexMap.set(delta.nodeId, 0);
            this.heapPriorities.set(delta.nodeId, {
              g: delta.afterState?.gCost ?? 0,
              h: delta.afterState?.hCost ?? 0,
              f: delta.afterState?.fCost ?? 0
            });
          }
          this.maxFrontierSize = Math.max(this.maxFrontierSize, this.frontier.length);
        } else if (delta.nodeId && delta.afterState?.traversalState === 'ACTIVE') {
          this.activeNodeHistory.push(this.activeNode);
          this.activeNode = delta.nodeId;
          this.nodesVisited++;
        }
        break;

      case 'EXAMINE_NODE':
        this.activeNodeHistory.push(this.activeNode);
        this.activeNode = delta.nodeId ?? null;
        this.nodesVisited++;
        break;

      case 'ENQUEUE_FRONTIER':
        if (delta.operationSubtype === 'DECREASE_KEY') {
          if (delta.heapSwaps) {
            for (const swap of delta.heapSwaps) {
              const temp = this.frontier[swap.indexA];
              this.frontier[swap.indexA] = this.frontier[swap.indexB];
              this.frontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.frontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.frontier[swap.indexB], swap.indexB);
            }
          }
          if (delta.nodeId && delta.afterState) {
            this.heapPriorities.set(delta.nodeId, {
              g: delta.afterState.gCost,
              h: delta.afterState.hCost,
              f: delta.afterState.fCost
            });
          }
        } else if (delta.nodeId) {
          this.frontier.push(delta.nodeId);
          if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
            this.heapIndexMap.set(delta.nodeId, this.frontier.length - 1);
            this.heapPriorities.set(delta.nodeId, {
              g: delta.afterState?.gCost ?? 0,
              h: delta.afterState?.hCost ?? 0,
              f: delta.afterState?.fCost ?? 0
            });
            if (delta.heapSwaps) {
              for (const swap of delta.heapSwaps) {
                const temp = this.frontier[swap.indexA];
                this.frontier[swap.indexA] = this.frontier[swap.indexB];
                this.frontier[swap.indexB] = temp;
                this.heapIndexMap.set(this.frontier[swap.indexA], swap.indexA);
                this.heapIndexMap.set(this.frontier[swap.indexB], swap.indexB);
              }
            }
          }
          this.maxFrontierSize = Math.max(this.maxFrontierSize, this.frontier.length);
        }
        break;

      case 'DEQUEUE_FRONTIER':
        if (this.algorithm === 'BFS') {
          this.dequeuedHistory.push(this.frontier.shift());
        } else if (this.algorithm === 'DFS') {
          this.dequeuedHistory.push(this.frontier.pop());
        } else {
          if (this.frontier.length > 0) {
            const root = this.frontier[0];
            const last = this.frontier.pop()!;
            this.dequeuedHistory.push({
              root,
              last: this.frontier.length > 0 ? last : null
            });
            this.heapIndexMap.delete(root);
            if (this.frontier.length > 0) {
              this.frontier[0] = last;
              this.heapIndexMap.set(last, 0);
            }
          }
          if (delta.heapSwaps) {
            for (const swap of delta.heapSwaps) {
              const temp = this.frontier[swap.indexA];
              this.frontier[swap.indexA] = this.frontier[swap.indexB];
              this.frontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.frontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.frontier[swap.indexB], swap.indexB);
            }
          }
        }
        break;

      case 'CLOSE_NODE':
        if (delta.nodeId) {
          this.closedNodes.add(delta.nodeId);
          if (this.activeNode === delta.nodeId) {
            this.activeNodeHistory.push(this.activeNode);
            this.activeNode = null;
          }
        }
        break;

      case 'PATH_FOUND':
        if (delta.nodeId) {
          this.path.push(delta.nodeId);
        }
        break;

      case 'NO_PATH_FOUND':
        this.pathHistory.push([...this.path]);
        this.path = [];
        break;

      case 'UPDATE_METRICS':
        break;
    }
  }

  private applyInverse(delta: TraceDelta): void {
    if (delta.nodeId && delta.beforeState) {
      this.cellStates.set(delta.nodeId, { ...delta.beforeState });
    }

    const prevMax = this.maxFrontierHistory.pop();
    if (prevMax !== undefined) {
      this.maxFrontierSize = prevMax;
    }

    switch (delta.action) {
      case 'INITIALIZE':
        if (delta.nodeId && delta.frontierSize > 0) {
          this.frontier.pop();
          if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
            this.heapIndexMap.delete(delta.nodeId);
            this.heapPriorities.delete(delta.nodeId);
          }
        } else if (delta.nodeId && delta.afterState?.traversalState === 'ACTIVE') {
          this.activeNode = this.activeNodeHistory.pop() ?? null;
          this.nodesVisited = Math.max(0, this.nodesVisited - 1);
        }
        break;

      case 'EXAMINE_NODE':
        this.activeNode = this.activeNodeHistory.pop() ?? null;
        this.nodesVisited = Math.max(0, this.nodesVisited - 1);
        break;

      case 'ENQUEUE_FRONTIER':
        if (delta.operationSubtype === 'DECREASE_KEY') {
          if (delta.heapSwaps) {
            for (let s = delta.heapSwaps.length - 1; s >= 0; s--) {
              const swap = delta.heapSwaps[s];
              const temp = this.frontier[swap.indexA];
              this.frontier[swap.indexA] = this.frontier[swap.indexB];
              this.frontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.frontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.frontier[swap.indexB], swap.indexB);
            }
          }
          if (delta.nodeId && delta.beforeState) {
            this.heapPriorities.set(delta.nodeId, {
              g: delta.beforeState.gCost,
              h: delta.beforeState.hCost,
              f: delta.beforeState.fCost
            });
          }
        } else if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
          if (delta.heapSwaps) {
            for (let s = delta.heapSwaps.length - 1; s >= 0; s--) {
              const swap = delta.heapSwaps[s];
              const temp = this.frontier[swap.indexA];
              this.frontier[swap.indexA] = this.frontier[swap.indexB];
              this.frontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.frontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.frontier[swap.indexB], swap.indexB);
            }
          }
          if (delta.nodeId) {
            this.frontier.pop();
            this.heapIndexMap.delete(delta.nodeId);
            this.heapPriorities.delete(delta.nodeId);
          }
        } else {
          this.frontier.pop();
        }
        break;

      case 'DEQUEUE_FRONTIER':
        if (this.algorithm === 'BFS') {
          const prev = this.dequeuedHistory.pop() as string | undefined;
          if (prev) this.frontier.unshift(prev);
        } else if (this.algorithm === 'DFS') {
          const prev = this.dequeuedHistory.pop() as string | undefined;
          if (prev) this.frontier.push(prev);
        } else {
          if (delta.heapSwaps) {
            for (let s = delta.heapSwaps.length - 1; s >= 0; s--) {
              const swap = delta.heapSwaps[s];
              const temp = this.frontier[swap.indexA];
              this.frontier[swap.indexA] = this.frontier[swap.indexB];
              this.frontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.frontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.frontier[swap.indexB], swap.indexB);
            }
          }
          const info = this.dequeuedHistory.pop() as DequeuedHeapInfo | undefined;
          if (info) {
            if (info.last !== null) {
              this.frontier[0] = info.root;
              this.heapIndexMap.set(info.root, 0);
              this.frontier.push(info.last);
              this.heapIndexMap.set(info.last, this.frontier.length - 1);
            } else {
              this.frontier.push(info.root);
              this.heapIndexMap.set(info.root, 0);
            }
          }
        }
        break;

      case 'CLOSE_NODE':
        if (delta.nodeId) {
          this.closedNodes.delete(delta.nodeId);
          this.activeNode = this.activeNodeHistory.pop() ?? null;
        }
        break;

      case 'PATH_FOUND':
        this.path.pop();
        break;

      case 'NO_PATH_FOUND': {
        const prevPath = this.pathHistory.pop();
        if (prevPath) this.path = prevPath;
        break;
      }

      case 'UPDATE_METRICS':
        break;
    }
  }
}
