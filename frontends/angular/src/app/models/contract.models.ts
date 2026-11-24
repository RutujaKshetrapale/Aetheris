export type CellType = 'EMPTY' | 'WALL' | 'START' | 'TARGET' | 'WEIGHTED';
export type TraversalState = 'UNVISITED' | 'IN_FRONTIER' | 'VISITED';
export type TraceAction = 'ENQUEUE' | 'DEQUEUE' | 'VISIT' | 'UPDATE_COST' | 'SET_PARENT' | 'MARK_PATH';
export type AlgorithmType = 'BFS' | 'DFS' | 'DIJKSTRA' | 'ASTAR';
export type HeuristicType = 'MANHATTAN' | 'EUCLIDEAN' | 'CHEBYSHEV';

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

export interface TraceDelta {
  step: number;
  nodeId: string;
  action: TraceAction;
  beforeState: CellState;
  afterState: CellState;
  frontierSize: number;
}

export interface ExecutionMetrics {
  nodesVisited: number;
  maxFrontierSize: number;
  executionTimeMs: number;
  pathLength: number;
  pathCost: number;
}

export interface PathfindingRequest {
  algorithm: AlgorithmType;
  grid: GridModel;
  heuristic?: HeuristicType;
  allowDiagonals?: boolean;
}

export interface PathfindingResponse {
  algorithm: AlgorithmType;
  pathFound: boolean;
  path: string[];
  pathCost: number;
  traceDeltas: TraceDelta[];
  metrics: ExecutionMetrics;
  reversible: boolean;
}

export interface HealthStatus {
  status: string;
  platform: string;
  version: string;
  persistenceEngine: string;
  databaseConnected: boolean;
}
