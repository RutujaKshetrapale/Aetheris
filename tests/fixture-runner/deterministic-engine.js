// Canonical Deterministic Pathfinding Reference Engine
// Used to generate and validate shared fixtures across Java and .NET backends

class DeterministicEngine {
  constructor() {
    this.DIRECTIONS = [
      { name: 'UP', dr: -1, dc: 0 },
      { name: 'RIGHT', dr: 0, dc: 1 },
      { name: 'DOWN', dr: 1, dc: 0 },
      { name: 'LEFT', dr: 0, dc: -1 }
    ];
  }

  nodeId(r, c) {
    return `r${r}c${c}`;
  }

  parseNodeId(id) {
    const match = id.match(/^r(\d+)c(\d+)$/);
    if (!match) throw new Error(`Invalid node id: ${id}`);
    return { row: parseInt(match[1], 10), col: parseInt(match[2], 10) };
  }

  createCellState(cellType, traversalState, inPath, gCost = 0, fCost = 0, parentId = null) {
    return {
      cellType,
      traversalState,
      inPath,
      gCost,
      fCost,
      parentId
    };
  }

  manhattan(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2);
  }

  run(algorithm, gridModel) {
    const { rows, cols, startNode, targetNode } = gridModel;
    const startPos = this.parseNodeId(startNode);
    const targetPos = this.parseNodeId(targetNode);

    // Initialize grid cells
    const cellMap = new Map();
    const cellTypeMap = new Map();
    const weightMap = new Map();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = this.nodeId(r, c);
        cellTypeMap.set(id, 'EMPTY');
        weightMap.set(id, 1.0);
      }
    }

    if (gridModel.cells) {
      for (const cell of gridModel.cells) {
        cellTypeMap.set(cell.id, cell.cellType);
        if (cell.weight !== undefined) weightMap.set(cell.id, cell.weight);
      }
    }

    cellTypeMap.set(startNode, 'START');
    cellTypeMap.set(targetNode, 'TARGET');

    // Dynamic state map
    const stateMap = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = this.nodeId(r, c);
        stateMap.set(id, this.createCellState(cellTypeMap.get(id), 'UNVISITED', false, Infinity, Infinity, null));
      }
    }

    const traceDeltas = [];
    let stepCount = 0;

    const recordDelta = (nodeId, action, afterStateUpdates, frontierSize) => {
      const beforeState = { ...stateMap.get(nodeId) };
      const afterState = { ...beforeState, ...afterStateUpdates };
      stateMap.set(nodeId, afterState);
      traceDeltas.push({
        step: stepCount++,
        nodeId,
        action,
        beforeState,
        afterState: { ...afterState },
        frontierSize
      });
    };

    let pathFound = false;
    let path = [];
    let pathCost = 0;
    let maxFrontierSize = 0;

    const startTime = Date.now();

    if (algorithm === 'BFS') {
      // FIFO Queue
      const queue = [];
      const inQueue = new Set();

      const startState = stateMap.get(startNode);
      recordDelta(startNode, 'ENQUEUE', { traversalState: 'IN_FRONTIER', gCost: 0, fCost: 0 }, 1);
      queue.push(startNode);
      inQueue.add(startNode);
      maxFrontierSize = Math.max(maxFrontierSize, queue.length);

      while (queue.length > 0) {
        maxFrontierSize = Math.max(maxFrontierSize, queue.length);
        const currId = queue.shift();
        inQueue.delete(currId);
        recordDelta(currId, 'DEQUEUE', {}, queue.length);
        recordDelta(currId, 'VISIT', { traversalState: 'VISITED' }, queue.length);

        if (currId === targetNode) {
          pathFound = true;
          break;
        }

        const currPos = this.parseNodeId(currId);
        const currState = stateMap.get(currId);

        for (const dir of this.DIRECTIONS) {
          const nr = currPos.row + dir.dr;
          const nc = currPos.col + dir.dc;

          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighborId = this.nodeId(nr, nc);
            const nType = cellTypeMap.get(neighborId);
            const nState = stateMap.get(neighborId);

            if (nType !== 'WALL' && nState.traversalState === 'UNVISITED' && !inQueue.has(neighborId)) {
              inQueue.add(neighborId);
              recordDelta(neighborId, 'SET_PARENT', { parentId: currId, gCost: currState.gCost + 1 }, queue.length);
              queue.push(neighborId);
              recordDelta(neighborId, 'ENQUEUE', { traversalState: 'IN_FRONTIER' }, queue.length);
              maxFrontierSize = Math.max(maxFrontierSize, queue.length);
            }
          }
        }
      }
    } else if (algorithm === 'DFS') {
      // LIFO Stack with ordered expansion [UP, RIGHT, DOWN, LEFT]
      // Push in reverse order [LEFT, DOWN, RIGHT, UP] so UP is popped first
      const stack = [];
      const inStack = new Set();

      recordDelta(startNode, 'ENQUEUE', { traversalState: 'IN_FRONTIER', gCost: 0, fCost: 0 }, 1);
      stack.push(startNode);
      inStack.add(startNode);
      maxFrontierSize = Math.max(maxFrontierSize, stack.length);

      while (stack.length > 0) {
        maxFrontierSize = Math.max(maxFrontierSize, stack.length);
        const currId = stack.pop();
        inStack.delete(currId);
        recordDelta(currId, 'DEQUEUE', {}, stack.length);
        recordDelta(currId, 'VISIT', { traversalState: 'VISITED' }, stack.length);

        if (currId === targetNode) {
          pathFound = true;
          break;
        }

        const currPos = this.parseNodeId(currId);
        const currState = stateMap.get(currId);

        // Collect valid neighbors in normal order [UP, RIGHT, DOWN, LEFT]
        const validNeighbors = [];
        for (const dir of this.DIRECTIONS) {
          const nr = currPos.row + dir.dr;
          const nc = currPos.col + dir.dc;

          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighborId = this.nodeId(nr, nc);
            const nType = cellTypeMap.get(neighborId);
            const nState = stateMap.get(neighborId);

            if (nType !== 'WALL' && nState.traversalState === 'UNVISITED' && !inStack.has(neighborId)) {
              validNeighbors.push(neighborId);
            }
          }
        }

        // Push valid neighbors in reverse order so the first neighbor (UP) is popped first
        for (let i = validNeighbors.length - 1; i >= 0; i--) {
          const nId = validNeighbors[i];
          inStack.add(nId);
          recordDelta(nId, 'SET_PARENT', { parentId: currId, gCost: currState.gCost + 1 }, stack.length);
          stack.push(nId);
          recordDelta(nId, 'ENQUEUE', { traversalState: 'IN_FRONTIER' }, stack.length);
          maxFrontierSize = Math.max(maxFrontierSize, stack.length);
        }
      }
    } else if (algorithm === 'DIJKSTRA' || algorithm === 'ASTAR') {
      // Deterministic Indexed Min-Heap
      let sequenceCounter = 0;
      const heap = [];
      const nodeIndex = new Map(); // id -> index in heap

      const compare = (a, b) => {
        if (Math.abs(a.fCost - b.fCost) > 1e-9) {
          return a.fCost - b.fCost;
        }
        if (algorithm === 'ASTAR') {
          if (Math.abs(a.hCost - b.hCost) > 1e-9) {
            return a.hCost - b.hCost;
          }
        }
        if (a.seq !== b.seq) {
          return a.seq - b.seq;
        }
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      };

      const swap = (i, j) => {
        const temp = heap[i];
        heap[i] = heap[j];
        heap[j] = temp;
        nodeIndex.set(heap[i].id, i);
        nodeIndex.set(heap[j].id, j);
      };

      const pushHeap = (item) => {
        heap.push(item);
        let idx = heap.length - 1;
        nodeIndex.set(item.id, idx);
        while (idx > 0) {
          const parentIdx = Math.floor((idx - 1) / 2);
          if (compare(heap[idx], heap[parentIdx]) < 0) {
            swap(idx, parentIdx);
            idx = parentIdx;
          } else {
            break;
          }
        }
        maxFrontierSize = Math.max(maxFrontierSize, heap.length);
      };

      const popHeap = () => {
        if (heap.length === 0) return null;
        const top = heap[0];
        const last = heap.pop();
        nodeIndex.delete(top.id);
        if (heap.length > 0) {
          heap[0] = last;
          nodeIndex.set(last.id, 0);
          let idx = 0;
          while (true) {
            const left = 2 * idx + 1;
            const right = 2 * idx + 2;
            let smallest = idx;
            if (left < heap.length && compare(heap[left], heap[smallest]) < 0) smallest = left;
            if (right < heap.length && compare(heap[right], heap[smallest]) < 0) smallest = right;
            if (smallest !== idx) {
              swap(idx, smallest);
              idx = smallest;
            } else {
              break;
            }
          }
        }
        return top;
      };

      const updateHeap = (id, newGCost, newFCost) => {
        const idx = nodeIndex.get(id);
        if (idx === undefined) return;
        heap[idx].gCost = newGCost;
        heap[idx].fCost = newFCost;
        // Sift up
        let curr = idx;
        while (curr > 0) {
          const parentIdx = Math.floor((curr - 1) / 2);
          if (compare(heap[curr], heap[parentIdx]) < 0) {
            swap(curr, parentIdx);
            curr = parentIdx;
          } else {
            break;
          }
        }
      };

      const hStart = algorithm === 'ASTAR' ? this.manhattan(startPos.row, startPos.col, targetPos.row, targetPos.col) : 0;
      const startItem = {
        id: startNode,
        row: startPos.row,
        col: startPos.col,
        gCost: 0,
        hCost: hStart,
        fCost: hStart,
        seq: sequenceCounter++
      };

      recordDelta(startNode, 'ENQUEUE', { traversalState: 'IN_FRONTIER', gCost: 0, fCost: hStart }, 1);
      pushHeap(startItem);

      while (heap.length > 0) {
        maxFrontierSize = Math.max(maxFrontierSize, heap.length);
        const top = popHeap();
        recordDelta(top.id, 'DEQUEUE', {}, heap.length);
        recordDelta(top.id, 'VISIT', { traversalState: 'VISITED' }, heap.length);

        if (top.id === targetNode) {
          pathFound = true;
          break;
        }

        const currState = stateMap.get(top.id);

        for (const dir of this.DIRECTIONS) {
          const nr = top.row + dir.dr;
          const nc = top.col + dir.dc;

          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighborId = this.nodeId(nr, nc);
            const nType = cellTypeMap.get(neighborId);
            const nState = stateMap.get(neighborId);

            if (nType === 'WALL' || nState.traversalState === 'VISITED') continue;

            const edgeWeight = weightMap.get(neighborId) || 1.0;
            const tentativeGCost = currState.gCost + edgeWeight;
            const h = algorithm === 'ASTAR' ? this.manhattan(nr, nc, targetPos.row, targetPos.col) : 0;
            const tentativeFCost = tentativeGCost + h;

            if (nState.traversalState === 'UNVISITED') {
              recordDelta(neighborId, 'SET_PARENT', { parentId: top.id, gCost: tentativeGCost, fCost: tentativeFCost }, heap.length);
              const item = {
                id: neighborId,
                row: nr,
                col: nc,
                gCost: tentativeGCost,
                hCost: h,
                fCost: tentativeFCost,
                seq: sequenceCounter++
              };
              pushHeap(item);
              recordDelta(neighborId, 'ENQUEUE', { traversalState: 'IN_FRONTIER' }, heap.length);
            } else if (nState.traversalState === 'IN_FRONTIER' && tentativeGCost < nState.gCost) {
              recordDelta(neighborId, 'UPDATE_COST', { parentId: top.id, gCost: tentativeGCost, fCost: tentativeFCost }, heap.length);
              updateHeap(neighborId, tentativeGCost, tentativeFCost);
            }
          }
        }
      }
    }

    // Reconstruct path if found
    if (pathFound) {
      let curr = targetNode;
      const reversePath = [];
      while (curr !== null) {
        reversePath.push(curr);
        const st = stateMap.get(curr);
        curr = st.parentId;
      }
      path = reversePath.reverse();
      pathCost = stateMap.get(targetNode).gCost;

      // Emit MARK_PATH trace deltas
      for (const pId of path) {
        recordDelta(pId, 'MARK_PATH', { inPath: true }, 0);
      }
    }

    const executionTimeMs = Math.max(0.01, Date.now() - startTime);

    const visitedCount = Array.from(stateMap.values()).filter(s => s.traversalState === 'VISITED').length;

    return {
      algorithm,
      pathFound,
      path,
      pathCost,
      traceDeltas,
      metrics: {
        nodesVisited: visitedCount,
        maxFrontierSize,
        executionTimeMs,
        pathLength: path.length,
        pathCost
      },
      reversible: true
    };
  }
}

module.exports = { DeterministicEngine };
