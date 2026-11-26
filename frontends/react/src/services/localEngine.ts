import {
  CellDefinition,
  CellState,
  HeapSwap,
  Keyframe,
  PathfindingRequest,
  PathfindingResponse,
  TraceAction,
  TraceDelta
} from '../types/contract';

interface HeapNode {
  id: string;
  row: number;
  col: number;
  gCost: number;
  hCost: number;
  fCost: number;
  seq: number;
}

class IndexedMinHeap {
  private isAStar: boolean;
  private heap: HeapNode[] = [];
  private indexMap: Map<string, number> = new Map();
  public swaps: HeapSwap[] = [];

  constructor(isAStar: boolean) {
    this.isAStar = isAStar;
  }

  drainSwaps(): HeapSwap[] {
    const res = [...this.swaps];
    this.swaps = [];
    return res;
  }

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  contains(id: string): boolean {
    return this.indexMap.has(id);
  }

  private compare(a: HeapNode, b: HeapNode): number {
    if (this.isAStar) {
      if (a.fCost !== b.fCost) return a.fCost - b.fCost;
      if (a.hCost !== b.hCost) return a.hCost - b.hCost;
      return a.seq - b.seq;
    } else {
      if (a.gCost !== b.gCost) return a.gCost - b.gCost;
      return a.seq - b.seq;
    }
  }

  private swap(i: number, j: number) {
    const a = this.heap[i];
    const b = this.heap[j];
    this.heap[i] = b;
    this.heap[j] = a;
    this.indexMap.set(b.id, i);
    this.indexMap.set(a.id, j);
    this.swaps.push({ indexA: i, indexB: j, nodeA: a.id, nodeB: b.id });
  }

  push(node: HeapNode) {
    this.heap.push(node);
    const idx = this.heap.length - 1;
    this.indexMap.set(node.id, idx);
    this.siftUp(idx);
  }

  pop(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    this.indexMap.delete(top.id);
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.indexMap.set(last.id, 0);
      this.siftDown(0);
    }
    return top;
  }

  decreaseKey(id: string, newGCost: number, newFCost: number) {
    const idx = this.indexMap.get(id);
    if (idx === undefined) return;
    const node = this.heap[idx];
    node.gCost = newGCost;
    node.fCost = newFCost;
    this.siftUp(idx);
  }

  private siftUp(idx: number) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.compare(this.heap[idx], this.heap[parent]) < 0) {
        this.swap(idx, parent);
        idx = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(idx: number) {
    const size = this.heap.length;
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;

      if (left < size && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < size && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== idx) {
        this.swap(idx, smallest);
        idx = smallest;
      } else {
        break;
      }
    }
  }

  getFrontierIds(): string[] {
    return this.heap.map((n) => n.id);
  }
}

export function executeLocalPathfinding(request: PathfindingRequest): PathfindingResponse {
  const startTime = performance.now();
  const { algorithm, grid } = request;
  const { rows, cols, startNode, targetNode } = grid;

  const parseNode = (id: string): [number, number] => {
    const parts = id.slice(1).split('c');
    return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
  };

  const [startR, startC] = parseNode(startNode);
  const [targetR, targetC] = parseNode(targetNode);

  // Cell types and weights
  const cellTypeMap = new Map<string, CellDefinition['cellType']>();
  const weightMap = new Map<string, number>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `r${r}c${c}`;
      cellTypeMap.set(id, 'EMPTY');
      weightMap.set(id, 1);
    }
  }
  cellTypeMap.set(startNode, 'START');
  weightMap.set(startNode, 0);
  cellTypeMap.set(targetNode, 'TARGET');
  weightMap.set(targetNode, 1);

  if (grid.cells) {
    for (const cell of grid.cells) {
      cellTypeMap.set(cell.id, cell.cellType);
      if (cell.cellType === 'WEIGHTED') {
        weightMap.set(cell.id, cell.weight ?? 1);
      } else if (cell.cellType === 'EMPTY') {
        weightMap.set(cell.id, 1);
      }
    }
  }

  // Calculate W_min for admissible Manhattan heuristic
  let minTraversableWeight = 1000;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `r${r}c${c}`;
      const type = cellTypeMap.get(id);
      if (type !== 'WALL' && type !== 'START') {
        const w = weightMap.get(id) || 1;
        if (w < minTraversableWeight) minTraversableWeight = w;
      }
    }
  }
  if (minTraversableWeight === 1000) minTraversableWeight = 1;

  const computeHeuristic = (r: number, c: number): number => {
    const manhattan = Math.abs(r - targetR) + Math.abs(c - targetC);
    return manhattan * minTraversableWeight;
  };

  // State maps
  const stateMap = new Map<string, CellState>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `r${r}c${c}`;
      stateMap.set(id, {
        cellType: cellTypeMap.get(id)!,
        traversalState: 'UNVISITED',
        inPath: false,
        gCost: null,
        hCost: null,
        fCost: null,
        parentId: null
      });
    }
  }

  const deltas: TraceDelta[] = [];
  const keyframes: Keyframe[] = [];
  let stepCounter = 0;
  let maxFrontierSize = 0;
  let seqCounter = 0;

  const cloneState = (s: CellState): CellState => ({ ...s });

  const recordDelta = (
    action: TraceAction,
    nodeId: string | null,
    before: CellState | null,
    after: CellState | null,
    frontierSize: number,
    swaps: HeapSwap[] = [],
    subtype: string | null = null
  ) => {
    const delta: TraceDelta = {
      step: stepCounter,
      action,
      operationSubtype: subtype,
      nodeId,
      beforeState: before ? cloneState(before) : null,
      afterState: after ? cloneState(after) : null,
      frontierSize,
      heapSwaps: swaps.length > 0 ? swaps : undefined
    };
    deltas.push(delta);

    if (frontierSize > maxFrontierSize) maxFrontierSize = frontierSize;

    if (stepCounter % 50 === 0) {
      const snap: Record<string, CellState> = {};
      stateMap.forEach((val, key) => {
        snap[key] = cloneState(val);
      });
      keyframes.push({
        step: stepCounter,
        cellStates: snap,
        frontier: getFrontierList(),
        activeNode: nodeId,
        closedCount: getClosedCount()
      });
    }

    stepCounter++;
  };

  // Frontiers
  const fifoQueue: string[] = [];
  const lifoStack: string[] = [];
  const minHeap = new IndexedMinHeap(algorithm === 'ASTAR');

  const getFrontierList = (): string[] => {
    if (algorithm === 'BFS') return [...fifoQueue];
    if (algorithm === 'DFS') return [...lifoStack];
    return minHeap.getFrontierIds();
  };

  const getClosedCount = (): number => {
    let count = 0;
    stateMap.forEach((s) => {
      if (s.traversalState === 'CLOSED') count++;
    });
    return count;
  };

  // INITIALIZE START NODE
  const startBefore = cloneState(stateMap.get(startNode)!);
  const startAfter = stateMap.get(startNode)!;
  startAfter.traversalState = 'FRONTIER';
  startAfter.gCost = 0;
  startAfter.hCost = algorithm === 'ASTAR' ? computeHeuristic(startR, startC) : 0;
  startAfter.fCost = startAfter.gCost + (startAfter.hCost ?? 0);

  if (algorithm === 'BFS') fifoQueue.push(startNode);
  else if (algorithm === 'DFS') lifoStack.push(startNode);
  else {
    minHeap.push({
      id: startNode,
      row: startR,
      col: startC,
      gCost: 0,
      hCost: startAfter.hCost ?? 0,
      fCost: startAfter.fCost ?? 0,
      seq: seqCounter++
    });
  }

  recordDelta('INITIALIZE', startNode, startBefore, startAfter, 1, minHeap.drainSwaps());

  let pathFound = false;
  let targetFoundNode: string | null = null;
  const visitedSet = new Set<string>();

  // Special case: startNode === targetNode
  if (startNode === targetNode) {
    pathFound = true;
    targetFoundNode = startNode;
  }

  // Traversal loop
  while (!pathFound) {
    let currentId: string | undefined;

    if (algorithm === 'BFS') {
      currentId = fifoQueue.shift();
    } else if (algorithm === 'DFS') {
      currentId = lifoStack.pop();
    } else {
      const top = minHeap.pop();
      currentId = top?.id;
    }

    if (!currentId) break;

    const curState = stateMap.get(currentId)!;
    const curBefore = cloneState(curState);
    curState.traversalState = 'ACTIVE';

    recordDelta(
      'DEQUEUE_FRONTIER',
      currentId,
      curBefore,
      curState,
      getFrontierList().length,
      minHeap.drainSwaps()
    );

    recordDelta(
      'EXAMINE_NODE',
      currentId,
      cloneState(curState),
      curState,
      getFrontierList().length
    );

    visitedSet.add(currentId);

    if (currentId === targetNode) {
      pathFound = true;
      targetFoundNode = currentId;
      break;
    }

    // Neighbors: UP, RIGHT, DOWN, LEFT
    const [cr, cc] = parseNode(currentId);
    const neighbors: { r: number; c: number }[] = [
      { r: cr - 1, c: cc },     // UP
      { r: cr, c: cc + 1 },     // RIGHT
      { r: cr + 1, c: cc },     // DOWN
      { r: cr, c: cc - 1 }      // LEFT
    ];

    if (algorithm === 'DFS') {
      // LIFO push order: LEFT, DOWN, RIGHT, UP
      const dfsNeighbors = [
        neighbors[3], // LEFT
        neighbors[2], // DOWN
        neighbors[1], // RIGHT
        neighbors[0]  // UP
      ];

      for (const n of dfsNeighbors) {
        if (n.r < 0 || n.r >= rows || n.c < 0 || n.c >= cols) continue;
        const nid = `r${n.r}c${n.c}`;
        if (cellTypeMap.get(nid) === 'WALL') continue;
        if (visitedSet.has(nid) || lifoStack.includes(nid)) continue;

        const nb = stateMap.get(nid)!;
        const nbBefore = cloneState(nb);
        nb.traversalState = 'FRONTIER';
        nb.parentId = currentId;
        lifoStack.push(nid);

        recordDelta('ENQUEUE_FRONTIER', nid, nbBefore, nb, lifoStack.length);
      }
    } else if (algorithm === 'BFS') {
      for (const n of neighbors) {
        if (n.r < 0 || n.r >= rows || n.c < 0 || n.c >= cols) continue;
        const nid = `r${n.r}c${n.c}`;
        if (cellTypeMap.get(nid) === 'WALL') continue;
        if (visitedSet.has(nid) || fifoQueue.includes(nid)) continue;

        const nb = stateMap.get(nid)!;
        const nbBefore = cloneState(nb);
        nb.traversalState = 'FRONTIER';
        nb.parentId = currentId;
        fifoQueue.push(nid);

        recordDelta('ENQUEUE_FRONTIER', nid, nbBefore, nb, fifoQueue.length);
      }
    } else {
      // Dijkstra / A*
      for (const n of neighbors) {
        if (n.r < 0 || n.r >= rows || n.c < 0 || n.c >= cols) continue;
        const nid = `r${n.r}c${n.c}`;
        if (cellTypeMap.get(nid) === 'WALL') continue;
        if (visitedSet.has(nid)) continue;

        const entryWeight = weightMap.get(nid) ?? 1;
        const newGCost = (curState.gCost ?? 0) + entryWeight;
        const nb = stateMap.get(nid)!;

        if (nb.traversalState === 'UNVISITED') {
          const nbBefore = cloneState(nb);
          nb.traversalState = 'FRONTIER';
          nb.parentId = currentId;
          nb.gCost = newGCost;
          nb.hCost = algorithm === 'ASTAR' ? computeHeuristic(n.r, n.c) : 0;
          nb.fCost = nb.gCost + (nb.hCost ?? 0);

          minHeap.push({
            id: nid,
            row: n.r,
            col: n.c,
            gCost: nb.gCost,
            hCost: nb.hCost,
            fCost: nb.fCost,
            seq: seqCounter++
          });

          recordDelta('ENQUEUE_FRONTIER', nid, nbBefore, nb, minHeap.size(), minHeap.drainSwaps());
        } else if (nb.traversalState === 'FRONTIER' && newGCost < (nb.gCost ?? Infinity)) {
          // DECREASE_KEY
          const nbBefore = cloneState(nb);
          nb.gCost = newGCost;
          nb.parentId = currentId;
          nb.fCost = nb.gCost + (nb.hCost ?? 0);

          minHeap.decreaseKey(nid, nb.gCost, nb.fCost);

          recordDelta(
            'ENQUEUE_FRONTIER',
            nid,
            nbBefore,
            nb,
            minHeap.size(),
            minHeap.drainSwaps(),
            'DECREASE_KEY'
          );
        }
      }
    }

    // CLOSE_NODE
    const closeBefore = cloneState(curState);
    curState.traversalState = 'CLOSED';
    recordDelta('CLOSE_NODE', currentId, closeBefore, curState, getFrontierList().length);
  }

  // Path reconstruction
  const path: string[] = [];
  if (pathFound && targetFoundNode) {
    let curr: string | null = targetFoundNode;
    while (curr) {
      path.unshift(curr);
      curr = stateMap.get(curr)?.parentId ?? null;
      if (curr === startNode) {
        path.unshift(startNode);
        break;
      }
    }

    // Mark inPath deltas
    for (const pNode of path) {
      const s = stateMap.get(pNode)!;
      const before = cloneState(s);
      s.inPath = true;
      recordDelta('PATH_FOUND', pNode, before, s, getFrontierList().length);
    }
  } else {
    recordDelta('NO_PATH_FOUND', null, null, null, 0);
  }

  // Calculate metrics
  const pathNodeCount = path.length;
  const pathEdgeCount = Math.max(0, path.length - 1);

  let terrainCost: number | null = null;
  let algoCost: number | null = null;

  if (pathFound) {
    let sumTerrain = 0;
    for (let i = 1; i < path.length; i++) {
      sumTerrain += weightMap.get(path[i]) ?? 1;
    }
    terrainCost = sumTerrain;

    if (algorithm === 'BFS' || algorithm === 'DFS') algoCost = pathEdgeCount;
    else algoCost = terrainCost;
  }

  const executionTimeMs = Math.max(0.01, Math.round((performance.now() - startTime) * 100) / 100);

  return {
    algorithm,
    pathFound,
    path,
    pathNodeCount,
    pathEdgeCount,
    algorithmPathCost: algoCost,
    terrainPathCost: terrainCost,
    traceDeltas: deltas,
    keyframes,
    metrics: {
      pathNodeCount,
      pathEdgeCount,
      algorithmPathCost: algoCost,
      terrainPathCost: terrainCost,
      nodesVisited: visitedSet.size,
      maxFrontierSize,
      executionTimeMs,
      totalSteps: deltas.length
    },
    reversible: true,
    noPathReason: pathFound ? null : 'FRONTIER_EXHAUSTED'
  };
}
