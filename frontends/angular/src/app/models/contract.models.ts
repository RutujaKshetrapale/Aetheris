export type CellType = 'EMPTY' | 'WALL' | 'START' | 'TARGET' | 'WEIGHTED';
export type TraversalState = 'UNVISITED' | 'FRONTIER' | 'ACTIVE' | 'CLOSED';
export type TraceAction =
  | 'INITIALIZE'
  | 'ENQUEUE_FRONTIER'
  | 'DEQUEUE_FRONTIER'
  | 'EXAMINE_NODE'
  | 'UPDATE_METRICS'
  | 'CLOSE_NODE'
  | 'PATH_FOUND'
  | 'NO_PATH_FOUND';

export type AlgorithmType = 'BFS' | 'DFS' | 'DIJKSTRA' | 'ASTAR';
export type HeuristicType = 'MANHATTAN';

export interface CellDefinition {
  id: string;
  row: number;
  col: number;
  cellType: CellType;
  weight?: number;
}

export interface CellState {
  cellType: CellType;
  traversalState: TraversalState;
  inPath: boolean;
  gCost?: number | null;
  hCost?: number | null;
  fCost?: number | null;
  parentId?: string | null;
}

export interface GridModel {
  rows: number;
  cols: number;
  startNode: string;
  targetNode: string;
  cells: CellDefinition[];
}

export interface HeapSwap {
  indexA: number;
  indexB: number;
  nodeA: string;
  nodeB: string;
}

export interface TraceDelta {
  step: number;
  action: TraceAction;
  operationSubtype?: string | null;
  nodeId?: string | null;
  beforeState?: CellState | null;
  afterState?: CellState | null;
  frontierSize: number;
  heapSwaps?: HeapSwap[];
  details?: string | null;
}

export interface Keyframe {
  step: number;
  cellStates: Record<string, CellState>;
  frontier: string[];
  activeNode?: string | null;
  closedCount: number;
}

export interface ExecutionMetrics {
  pathNodeCount: number;
  pathEdgeCount: number;
  algorithmPathCost: number | null;
  terrainPathCost: number | null;
  nodesVisited: number;
  maxFrontierSize: number;
  executionTimeMs: number;
  totalSteps: number;
}

export interface PathfindingRequest {
  algorithm: AlgorithmType;
  grid: GridModel;
  heuristic?: HeuristicType;
}

export interface PathfindingResponse {
  algorithm: AlgorithmType;
  pathFound: boolean;
  path: string[];
  pathNodeCount: number;
  pathEdgeCount: number;
  algorithmPathCost: number | null;
  terrainPathCost: number | null;
  traceDeltas: TraceDelta[];
  keyframes?: Keyframe[];
  metrics: ExecutionMetrics;
  reversible: boolean;
  noPathReason?: string | null;
}

export interface HealthStatus {
  status: string;
  engineStatus: string;
  persistenceStatus: string;
  platform: string;
  version: string;
  persistenceEngine: string;
  databaseConnected: boolean;
}
