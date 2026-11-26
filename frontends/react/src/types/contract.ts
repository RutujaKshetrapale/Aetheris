// Canonical contract types matching Revision 2.1.0 and OpenAPI 3.2.0

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

export interface AlgorithmInfo {
  id: AlgorithmType;
  name: string;
  description: string;
  weighted: boolean;
  guaranteedShortestPath: boolean;
  frontierType: string;
}

export interface GridPreset {
  id: string;
  name: string;
  description?: string;
  grid: GridModel;
  createdAt?: string;
}

export interface SavePresetRequest {
  id?: string;
  name: string;
  description?: string;
  grid: GridModel;
}

export interface ExportPresetsRequest {
  presetIds?: string[];
}

export interface PresetBundle {
  format: 'aetheris-preset-bundle';
  formatVersion: '1.0.0';
  exportedAt?: string;
  contentHash?: string;
  presets: GridPreset[];
}

export interface ImportPresetsResponse {
  importedCount: number;
  presets: GridPreset[];
}

export interface BenchmarkRequest {
  name?: string;
  presetId?: string;
  algorithm: AlgorithmType;
  heuristic?: HeuristicType;
  grid?: GridModel;
}

export interface BenchmarkRecord {
  id: string;
  name?: string | null;
  presetId?: string | null;
  algorithm: AlgorithmType;
  heuristic: HeuristicType;
  gridRows: number;
  gridCols: number;
  startNode: string;
  targetNode: string;
  pathFound: boolean;
  pathNodeCount: number;
  pathEdgeCount: number;
  algorithmPathCost: number | null;
  terrainPathCost: number | null;
  nodesVisited: number;
  maxFrontierSize: number;
  totalSteps: number;
  executionTimeMs: number;
  createdAt: string;
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

export interface ProbeStatus {
  status: string;
}

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, unknown>;
}
