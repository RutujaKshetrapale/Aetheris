import { Injectable } from '@angular/core';
import {
  CellDefinition,
  CellState,
  HeapSwap,
  Keyframe,
  PathfindingRequest,
  PathfindingResponse,
  TraceAction,
  TraceDelta
} from '../models/contract.models';

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
  private heap: HeapNode[] = [];
  private indexMap = new Map<string, number>();
  public swaps: HeapSwap[] = [];

  constructor(private isAStar: boolean) {}

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
    }
    if (a.gCost !== b.gCost) return a.gCost - b.gCost;
    return a.seq - b.seq;
  }

  private swap(i: number, j: number): void {
    const a = this.heap[i];
    const b = this.heap[j];
    this.heap[i] = b;
    this.heap[j] = a;
    this.indexMap.set(b.id, i);
    this.indexMap.set(a.id, j);
    this.swaps.push({ indexA: i, indexB: j, nodeA: a.id, nodeB: b.id });
  }

  push(node: HeapNode): void {
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

  decreaseKey(id: string, newGCost: number, newFCost: number): void {
    const idx = this.indexMap.get(id);
    if (idx === undefined) return;
    const node = this.heap[idx];
    node.gCost = newGCost;
    node.fCost = newFCost;
    this.siftUp(idx);
  }

  private siftUp(idx: number): void {
    let i = idx;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(this.heap[i], this.heap[parent]) < 0) {
        this.swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(idx: number): void {
    let i = idx;
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.compare(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < n && this.compare(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest !== i) {
        this.swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  toArrayIds(): string[] {
    return this.heap.map((n) => n.id);
  }
}

interface InternalCell extends CellState {
  id: string;
  row: number;
  col: number;
  weight: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocalEngineService {
  execute(request: PathfindingRequest): PathfindingResponse {
    const startTime = performance.now();
    const { algorithm, grid } = request;
    const { rows, cols, startNode, targetNode, cells } = grid;

    const gridMap = new Map<string, InternalCell>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `r${r}c${c}`;
        let cellType: CellState['cellType'] = 'EMPTY';
        if (id === targetNode) cellType = 'TARGET';
        if (id === startNode) cellType = 'START';
        gridMap.set(id, {
          id,
          row: r,
          col: c,
          cellType,
          weight: 1,
          traversalState: 'UNVISITED',
          inPath: false,
          gCost: null,
          hCost: null,
          fCost: null,
          parentId: null
        });
      }
    }

    if (cells) {
      for (const cDef of cells as CellDefinition[]) {
        const cur = gridMap.get(cDef.id);
        if (cur && cur.id !== startNode && cur.id !== targetNode) {
          cur.cellType = cDef.cellType;
          cur.weight = cDef.cellType === 'WEIGHTED' ? cDef.weight ?? 5 : 1;
        }
      }
    }

    const deltas: TraceDelta[] = [];
    const keyframes: Keyframe[] = [];
    let stepCounter = 0;
    let nodesVisited = 0;
    let maxFrontierSize = 0;
    let seqCounter = 0;
    let closedCount = 0;
    let activeNodeId: string | null = null;

    const getSnapshot = (cell: InternalCell): CellState => ({
      cellType: cell.cellType,
      traversalState: cell.traversalState,
      inPath: cell.inPath,
      gCost: cell.gCost,
      hCost: cell.hCost,
      fCost: cell.fCost,
      parentId: cell.parentId
    });

    const manhattan = (r1: number, c1: number, r2: number, c2: number) =>
      Math.abs(r1 - r2) + Math.abs(c1 - c2);

    const recordDelta = (
      action: TraceAction,
      nodeId: string | null,
      beforeState: CellState | null,
      afterState: CellState | null,
      frontierSize: number,
      currentFrontierIds: string[],
      subtype: string | null = null,
      heapSwaps: HeapSwap[] = [],
      details: string | null = null
    ) => {
      const step = stepCounter++;
      deltas.push({
        step,
        action,
        operationSubtype: subtype,
        nodeId,
        beforeState,
        afterState,
        frontierSize,
        heapSwaps,
        details
      });

      if (step % 50 === 0) {
        const kfCells: Record<string, CellState> = {};
        for (const [k, v] of gridMap.entries()) {
          kfCells[k] = getSnapshot(v);
        }
        keyframes.push({
          step,
          cellStates: kfCells,
          frontier: [...currentFrontierIds],
          activeNode: activeNodeId,
          closedCount
        });
      }
    };

    const startCell = gridMap.get(startNode)!;
    const targetCell = gridMap.get(targetNode)!;

    let pathFound = false;
    const path: string[] = [];

    if (startNode === targetNode) {
      const beforeStart = getSnapshot(startCell);
      startCell.traversalState = 'ACTIVE';
      startCell.gCost = 0;
      startCell.hCost = 0;
      startCell.fCost = 0;
      recordDelta('INITIALIZE', startNode, beforeStart, getSnapshot(startCell), 0, [], null, [], 'Start equals Target');

      const beforePath = getSnapshot(startCell);
      startCell.inPath = true;
      recordDelta('PATH_FOUND', startNode, beforePath, getSnapshot(startCell), 0, [], null, [], 'Trivial path found');
      pathFound = true;
      path.push(startNode);
    } else if (algorithm === 'BFS' || algorithm === 'DFS') {
      const frontier: InternalCell[] = [];
      const visited = new Set<string>();

      const beforeStart = getSnapshot(startCell);
      startCell.traversalState = 'FRONTIER';
      startCell.gCost = 0;
      visited.add(startNode);
      frontier.push(startCell);
      maxFrontierSize = 1;
      recordDelta('INITIALIZE', startNode, beforeStart, getSnapshot(startCell), frontier.length, frontier.map((n) => n.id));

      while (frontier.length > 0) {
        const current = algorithm === 'BFS' ? frontier.shift()! : frontier.pop()!;
        const beforeDeq = getSnapshot(current);
        current.traversalState = 'ACTIVE';
        activeNodeId = current.id;
        recordDelta('DEQUEUE_FRONTIER', current.id, beforeDeq, getSnapshot(current), frontier.length, frontier.map((n) => n.id));

        nodesVisited++;
        recordDelta('EXAMINE_NODE', current.id, null, null, frontier.length, frontier.map((n) => n.id));

        if (current.id === targetNode) {
          pathFound = true;
          break;
        }

        const dirs: [number, number][] = [
          [-1, 0],
          [0, 1],
          [1, 0],
          [0, -1]
        ];
        for (const [dr, dc] of dirs) {
          const nr = current.row + dr;
          const nc = current.col + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const nId = `r${nr}c${nc}`;
          const neighbor = gridMap.get(nId)!;
          if (neighbor.cellType === 'WALL' || visited.has(nId)) continue;

          visited.add(nId);
          const beforeN = getSnapshot(neighbor);
          neighbor.traversalState = 'FRONTIER';
          neighbor.parentId = current.id;
          neighbor.gCost = (current.gCost ?? 0) + 1;
          frontier.push(neighbor);
          maxFrontierSize = Math.max(maxFrontierSize, frontier.length);
          recordDelta('ENQUEUE_FRONTIER', nId, beforeN, getSnapshot(neighbor), frontier.length, frontier.map((n) => n.id));
        }

        const beforeClose = getSnapshot(current);
        current.traversalState = 'CLOSED';
        closedCount++;
        activeNodeId = null;
        recordDelta('CLOSE_NODE', current.id, beforeClose, getSnapshot(current), frontier.length, frontier.map((n) => n.id));
      }
    } else {
      const isAStar = algorithm === 'ASTAR';
      const heap = new IndexedMinHeap(isAStar);
      const closed = new Set<string>();

      const h0 = isAStar ? manhattan(startCell.row, startCell.col, targetCell.row, targetCell.col) : 0;
      const beforeStart = getSnapshot(startCell);
      startCell.traversalState = 'FRONTIER';
      startCell.gCost = 0;
      startCell.hCost = h0;
      startCell.fCost = h0;
      heap.push({
        id: startNode,
        row: startCell.row,
        col: startCell.col,
        gCost: 0,
        hCost: h0,
        fCost: h0,
        seq: seqCounter++
      });
      heap.drainSwaps();
      maxFrontierSize = 1;
      recordDelta('INITIALIZE', startNode, beforeStart, getSnapshot(startCell), heap.size(), heap.toArrayIds());

      while (!heap.isEmpty()) {
        const top = heap.pop()!;
        const current = gridMap.get(top.id)!;
        const popSwaps = heap.drainSwaps();
        const beforeDeq = getSnapshot(current);
        current.traversalState = 'ACTIVE';
        activeNodeId = current.id;
        recordDelta('DEQUEUE_FRONTIER', current.id, beforeDeq, getSnapshot(current), heap.size(), heap.toArrayIds(), null, popSwaps);

        nodesVisited++;
        recordDelta('EXAMINE_NODE', current.id, null, null, heap.size(), heap.toArrayIds());

        if (current.id === targetNode) {
          pathFound = true;
          break;
        }

        const dirs: [number, number][] = [
          [-1, 0],
          [0, 1],
          [1, 0],
          [0, -1]
        ];
        for (const [dr, dc] of dirs) {
          const nr = current.row + dr;
          const nc = current.col + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const nId = `r${nr}c${nc}`;
          const neighbor = gridMap.get(nId)!;
          if (neighbor.cellType === 'WALL' || closed.has(nId)) continue;

          const entryWeight = neighbor.id === startNode ? 0 : neighbor.weight;
          const newG = (current.gCost ?? 0) + entryWeight;
          const hVal = isAStar ? manhattan(nr, nc, targetCell.row, targetCell.col) : 0;
          const newF = newG + hVal;

          if (!heap.contains(nId)) {
            const beforeN = getSnapshot(neighbor);
            neighbor.traversalState = 'FRONTIER';
            neighbor.parentId = current.id;
            neighbor.gCost = newG;
            neighbor.hCost = hVal;
            neighbor.fCost = newF;
            heap.push({
              id: nId,
              row: nr,
              col: nc,
              gCost: newG,
              hCost: hVal,
              fCost: newF,
              seq: seqCounter++
            });
            const pushSwaps = heap.drainSwaps();
            maxFrontierSize = Math.max(maxFrontierSize, heap.size());
            recordDelta('ENQUEUE_FRONTIER', nId, beforeN, getSnapshot(neighbor), heap.size(), heap.toArrayIds(), null, pushSwaps);
          } else if (newG < (neighbor.gCost ?? Infinity)) {
            const beforeN = getSnapshot(neighbor);
            neighbor.parentId = current.id;
            neighbor.gCost = newG;
            neighbor.hCost = hVal;
            neighbor.fCost = newF;
            heap.decreaseKey(nId, newG, newF);
            const decSwaps = heap.drainSwaps();
            recordDelta('ENQUEUE_FRONTIER', nId, beforeN, getSnapshot(neighbor), heap.size(), heap.toArrayIds(), 'DECREASE_KEY', decSwaps);
          }
        }

        closed.add(current.id);
        const beforeClose = getSnapshot(current);
        current.traversalState = 'CLOSED';
        closedCount++;
        activeNodeId = null;
        recordDelta('CLOSE_NODE', current.id, beforeClose, getSnapshot(current), heap.size(), heap.toArrayIds());
      }
    }

    if (pathFound && startNode !== targetNode) {
      let curId: string | null | undefined = targetNode;
      while (curId) {
        path.unshift(curId);
        curId = gridMap.get(curId)?.parentId;
      }
      for (const pId of path) {
        const cell = gridMap.get(pId)!;
        const beforeP = getSnapshot(cell);
        cell.inPath = true;
        recordDelta('PATH_FOUND', pId, beforeP, getSnapshot(cell), 0, []);
      }
    } else if (!pathFound) {
      recordDelta('NO_PATH_FOUND', null, null, null, 0, [], null, [], 'FRONTIER_EXHAUSTED');
    }

    let algorithmPathCost: number | null = null;
    let terrainPathCost: number | null = null;
    if (pathFound) {
      terrainPathCost = 0;
      for (let i = 1; i < path.length; i++) {
        terrainPathCost += gridMap.get(path[i])!.weight;
      }
      algorithmPathCost = algorithm === 'BFS' || algorithm === 'DFS' ? path.length - 1 : terrainPathCost;
    }

    const executionTimeMs = Math.max(0.01, Number((performance.now() - startTime).toFixed(3)));

    return {
      algorithm,
      pathFound,
      path,
      pathNodeCount: pathFound ? path.length : 0,
      pathEdgeCount: pathFound ? Math.max(0, path.length - 1) : 0,
      algorithmPathCost,
      terrainPathCost,
      traceDeltas: deltas,
      keyframes,
      metrics: {
        pathNodeCount: pathFound ? path.length : 0,
        pathEdgeCount: pathFound ? Math.max(0, path.length - 1) : 0,
        algorithmPathCost,
        terrainPathCost,
        nodesVisited,
        maxFrontierSize,
        executionTimeMs,
        totalSteps: deltas.length
      },
      reversible: true,
      noPathReason: pathFound ? null : 'FRONTIER_EXHAUSTED'
    };
  }
}
