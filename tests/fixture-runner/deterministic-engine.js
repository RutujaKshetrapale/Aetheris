// Canonical Deterministic Reference Engine for AETHERIS Revision 2.1.0
// Compliant with integer costs, exact comparators (f, h, seq) / (g, 0, seq),
// physical heap swap trails, keyframes (K=50), and event taxonomy.

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

  manhattan(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2);
  }

  createCellState(cellType, traversalState = 'UNVISITED', inPath = false, gCost = null, hCost = null, fCost = null, parentId = null) {
    return {
      cellType,
      traversalState,
      inPath,
      gCost,
      hCost,
      fCost,
      parentId
    };
  }

  cloneCellState(cs) {
    return { ...cs };
  }

  run(algorithm, gridModel) {
    const startTime = Date.now();
    const { rows, cols, startNode, targetNode } = gridModel;
    const startPos = this.parseNodeId(startNode);
    const targetPos = this.parseNodeId(targetNode);

    // Initialize static cell types and weights
    const cellTypeMap = new Map();
    const weightMap = new Map();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = this.nodeId(r, c);
        cellTypeMap.set(id, 'EMPTY');
        weightMap.set(id, 1); // default integer entry cost = 1
      }
    }

    if (gridModel.cells) {
      for (const cell of gridModel.cells) {
        cellTypeMap.set(cell.id, cell.cellType);
        if (cell.weight !== undefined) {
          weightMap.set(cell.id, Math.floor(cell.weight));
        }
      }
    }

    cellTypeMap.set(targetNode, 'TARGET');
    cellTypeMap.set(startNode, 'START');
    weightMap.set(startNode, 0); // START contributes zero entry cost

    // Initialize mutable cell dynamic state
    const stateMap = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = this.nodeId(r, c);
        stateMap.set(id, this.createCellState(cellTypeMap.get(id)));
      }
    }

    const traceDeltas = [];
    const keyframes = [];
    let step = 0;
    let maxFrontierSize = 0;
    let visitedCount = 0;
    const closedSet = new Set();
    let activeNode = null;
    let getFrontierIds = () => [];

    const recordDelta = (action, nodeId, afterUpdates, frontierSize, heapSwaps = [], details = null) => {
      let beforeState = null;
      let afterState = null;

      if (nodeId && stateMap.has(nodeId)) {
        beforeState = this.cloneCellState(stateMap.get(nodeId));
        afterState = { ...beforeState, ...afterUpdates };
        stateMap.set(nodeId, afterState);
      }

      const delta = {
        step: step++,
        action,
        nodeId: nodeId || null,
        beforeState,
        afterState,
        frontierSize,
        heapSwaps: heapSwaps && heapSwaps.length > 0 ? heapSwaps : [],
        details: details || null
      };
      traceDeltas.push(delta);

      // Create keyframe every 50 steps
      if (delta.step % 50 === 0) {
        captureKeyframe(delta.step, frontierSize);
      }

      return delta;
    };

    const captureKeyframe = (stepNumber, frontierSize) => {
      const cellStatesObj = {};
      for (const [id, cs] of stateMap.entries()) {
        cellStatesObj[id] = this.cloneCellState(cs);
      }
      keyframes.push({
        step: stepNumber,
        cellStates: cellStatesObj,
        frontier: getFrontierIds(),
        activeNode: activeNode || null,
        closedCount: closedSet.size
      });
    };

    let pathFound = false;
    let path = [];
    let pathNodeCount = 0;
    let pathEdgeCount = 0;
    let algorithmPathCost = null;
    let terrainPathCost = null;

    // Special Case: Start equals target
    if (startNode === targetNode) {
      // Step 0: INITIALIZE
      recordDelta('INITIALIZE', startNode, {
        traversalState: 'ACTIVE',
        gCost: 0,
        hCost: 0,
        fCost: 0,
        parentId: null
      }, 0, [], 'Start equals target initialization');

      // Step 1: PATH_FOUND
      recordDelta('PATH_FOUND', startNode, {
        inPath: true,
        traversalState: 'CLOSED'
      }, 0, [], 'Target is start node');

      path = [startNode];
      pathNodeCount = 1;
      pathEdgeCount = 0;
      algorithmPathCost = 0;
      terrainPathCost = 0;
      visitedCount = 1;

      const executionTimeMs = Math.max(0.01, Date.now() - startTime);
      return {
        algorithm,
        pathFound: true,
        path,
        pathNodeCount,
        pathEdgeCount,
        algorithmPathCost,
        terrainPathCost,
        traceDeltas,
        keyframes,
        metrics: {
          pathNodeCount: 1,
          pathEdgeCount: 0,
          algorithmPathCost: 0,
          terrainPathCost: 0,
          nodesVisited: 1,
          maxFrontierSize: 0,
          executionTimeMs,
          totalSteps: traceDeltas.length
        },
        reversible: true,
        noPathReason: null
      };
    }

    // Normal Execution
    if (algorithm === 'BFS') {
      const queue = [];
      const inFrontierSet = new Set();
      getFrontierIds = () => [...queue];

      // INITIALIZE
      recordDelta('INITIALIZE', startNode, {
        traversalState: 'FRONTIER',
        gCost: 0,
        hCost: 0,
        fCost: 0,
        parentId: null
      }, 1, [], 'Initialize start node in BFS queue');
      queue.push(startNode);
      inFrontierSet.add(startNode);
      maxFrontierSize = Math.max(maxFrontierSize, queue.length);

      while (queue.length > 0) {
        maxFrontierSize = Math.max(maxFrontierSize, queue.length);
        const currId = queue.shift();
        inFrontierSet.delete(currId);

        recordDelta('DEQUEUE_FRONTIER', currId, {}, queue.length);

        activeNode = currId;
        recordDelta('EXAMINE_NODE', currId, { traversalState: 'ACTIVE' }, queue.length);
        visitedCount++;

        if (currId === targetNode) {
          pathFound = true;
          recordDelta('CLOSE_NODE', currId, { traversalState: 'CLOSED' }, queue.length);
          closedSet.add(currId);
          activeNode = null;
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

            if (nType !== 'WALL' && nState.traversalState === 'UNVISITED' && !inFrontierSet.has(neighborId)) {
              inFrontierSet.add(neighborId);
              queue.push(neighborId);
              maxFrontierSize = Math.max(maxFrontierSize, queue.length);

              recordDelta('ENQUEUE_FRONTIER', neighborId, {
                traversalState: 'FRONTIER',
                parentId: currId,
                gCost: currState.gCost + 1,
                fCost: currState.gCost + 1
              }, queue.length);
            }
          }
        }

        recordDelta('CLOSE_NODE', currId, { traversalState: 'CLOSED' }, queue.length);
        closedSet.add(currId);
        activeNode = null;
      }
    } else if (algorithm === 'DFS') {
      const stack = [];
      const inFrontierSet = new Set();
      getFrontierIds = () => [...stack];

      // INITIALIZE
      recordDelta('INITIALIZE', startNode, {
        traversalState: 'FRONTIER',
        gCost: 0,
        hCost: 0,
        fCost: 0,
        parentId: null
      }, 1, [], 'Initialize start node in DFS stack');
      stack.push(startNode);
      inFrontierSet.add(startNode);
      maxFrontierSize = Math.max(maxFrontierSize, stack.length);

      while (stack.length > 0) {
        maxFrontierSize = Math.max(maxFrontierSize, stack.length);
        const currId = stack.pop();
        inFrontierSet.delete(currId);

        recordDelta('DEQUEUE_FRONTIER', currId, {}, stack.length);

        activeNode = currId;
        recordDelta('EXAMINE_NODE', currId, { traversalState: 'ACTIVE' }, stack.length);
        visitedCount++;

        if (currId === targetNode) {
          pathFound = true;
          recordDelta('CLOSE_NODE', currId, { traversalState: 'CLOSED' }, stack.length);
          closedSet.add(currId);
          activeNode = null;
          break;
        }

        const currPos = this.parseNodeId(currId);
        const currState = stateMap.get(currId);

        // Collect valid neighbors in order [UP, RIGHT, DOWN, LEFT]
        const validNeighbors = [];
        for (const dir of this.DIRECTIONS) {
          const nr = currPos.row + dir.dr;
          const nc = currPos.col + dir.dc;

          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighborId = this.nodeId(nr, nc);
            const nType = cellTypeMap.get(neighborId);
            const nState = stateMap.get(neighborId);

            if (nType !== 'WALL' && nState.traversalState === 'UNVISITED' && !inFrontierSet.has(neighborId)) {
              validNeighbors.push(neighborId);
            }
          }
        }

        // Push in reverse order: LEFT, DOWN, RIGHT, UP so that UP is popped first
        for (let i = validNeighbors.length - 1; i >= 0; i--) {
          const nId = validNeighbors[i];
          inFrontierSet.add(nId);
          stack.push(nId);
          maxFrontierSize = Math.max(maxFrontierSize, stack.length);

          recordDelta('ENQUEUE_FRONTIER', nId, {
            traversalState: 'FRONTIER',
            parentId: currId,
            gCost: currState.gCost + 1,
            fCost: currState.gCost + 1
          }, stack.length);
        }

        recordDelta('CLOSE_NODE', currId, { traversalState: 'CLOSED' }, stack.length);
        closedSet.add(currId);
        activeNode = null;
      }
    } else if (algorithm === 'DIJKSTRA' || algorithm === 'ASTAR') {
      const isAStar = (algorithm === 'ASTAR');
      let enqueueSequence = 0;
      const heap = []; // physical heap array
      const indexMap = new Map(); // id -> index
      getFrontierIds = () => heap.map(item => item.id);

      // Strict comparator:
      // Dijkstra: (g, 0, enqueueSequence)
      // A*: (f, h, enqueueSequence)
      // No row/col tie-breaker!
      const compare = (a, b) => {
        if (a.fCost !== b.fCost) return a.fCost - b.fCost;
        if (isAStar && a.hCost !== b.hCost) return a.hCost - b.hCost;
        return a.seq - b.seq;
      };

      const swapWithTrail = (i, j, swaps) => {
        const itemA = heap[i];
        const itemB = heap[j];
        swaps.push({ indexA: i, indexB: j, nodeA: itemA.id, nodeB: itemB.id });
        heap[i] = itemB;
        heap[j] = itemA;
        indexMap.set(itemB.id, i);
        indexMap.set(itemA.id, j);
      };

      const pushHeap = (item) => {
        const swaps = [];
        heap.push(item);
        let idx = heap.length - 1;
        indexMap.set(item.id, idx);
        while (idx > 0) {
          const parentIdx = Math.floor((idx - 1) / 2);
          if (compare(heap[idx], heap[parentIdx]) < 0) {
            swapWithTrail(idx, parentIdx, swaps);
            idx = parentIdx;
          } else {
            break;
          }
        }
        maxFrontierSize = Math.max(maxFrontierSize, heap.length);
        return swaps;
      };

      const popHeap = () => {
        if (heap.length === 0) return { top: null, swaps: [] };
        const swaps = [];
        const top = heap[0];
        const last = heap.pop();
        indexMap.delete(top.id);

        if (heap.length > 0) {
          heap[0] = last;
          indexMap.set(last.id, 0);
          let idx = 0;
          while (true) {
            const left = 2 * idx + 1;
            const right = 2 * idx + 2;
            let smallest = idx;
            if (left < heap.length && compare(heap[left], heap[smallest]) < 0) smallest = left;
            if (right < heap.length && compare(heap[right], heap[smallest]) < 0) smallest = right;
            if (smallest !== idx) {
              swapWithTrail(idx, smallest, swaps);
              idx = smallest;
            } else {
              break;
            }
          }
        }
        return { top, swaps };
      };

      const decreaseKeyHeap = (id, newGCost, newFCost) => {
        const swaps = [];
        const idx = indexMap.get(id);
        if (idx === undefined) return swaps;
        heap[idx].gCost = newGCost;
        heap[idx].fCost = newFCost;
        // Preserves original enqueue sequence per specification
        let curr = idx;
        while (curr > 0) {
          const parentIdx = Math.floor((curr - 1) / 2);
          if (compare(heap[curr], heap[parentIdx]) < 0) {
            swapWithTrail(curr, parentIdx, swaps);
            curr = parentIdx;
          } else {
            break;
          }
        }
        return swaps;
      };

      const hStart = isAStar ? this.manhattan(startPos.row, startPos.col, targetPos.row, targetPos.col) : 0;
      const startItem = {
        id: startNode,
        row: startPos.row,
        col: startPos.col,
        gCost: 0,
        hCost: hStart,
        fCost: hStart,
        seq: enqueueSequence++
      };

      const initSwaps = pushHeap(startItem);
      recordDelta('INITIALIZE', startNode, {
        traversalState: 'FRONTIER',
        gCost: 0,
        hCost: hStart,
        fCost: hStart,
        parentId: null
      }, 1, initSwaps, 'Initialize start in min-heap');

      while (heap.length > 0) {
        maxFrontierSize = Math.max(maxFrontierSize, heap.length);
        const { top, swaps } = popHeap();

        recordDelta('DEQUEUE_FRONTIER', top.id, {}, heap.length, swaps);

        activeNode = top.id;
        recordDelta('EXAMINE_NODE', top.id, { traversalState: 'ACTIVE' }, heap.length);
        visitedCount++;

        if (top.id === targetNode) {
          pathFound = true;
          recordDelta('CLOSE_NODE', top.id, { traversalState: 'CLOSED' }, heap.length);
          closedSet.add(top.id);
          activeNode = null;
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

            if (nType === 'WALL' || nState.traversalState === 'CLOSED') continue;

            const edgeWeight = weightMap.get(neighborId) || 1;
            const tentativeGCost = currState.gCost + edgeWeight;
            const h = isAStar ? this.manhattan(nr, nc, targetPos.row, targetPos.col) : 0;
            const tentativeFCost = tentativeGCost + h;

            if (nState.traversalState === 'UNVISITED') {
              const item = {
                id: neighborId,
                row: nr,
                col: nc,
                gCost: tentativeGCost,
                hCost: h,
                fCost: tentativeFCost,
                seq: enqueueSequence++
              };
              const pushSwaps = pushHeap(item);
              recordDelta('ENQUEUE_FRONTIER', neighborId, {
                traversalState: 'FRONTIER',
                parentId: top.id,
                gCost: tentativeGCost,
                hCost: h,
                fCost: tentativeFCost
              }, heap.length, pushSwaps);
            } else if (nState.traversalState === 'FRONTIER' && tentativeGCost < nState.gCost) {
              const decSwaps = decreaseKeyHeap(neighborId, tentativeGCost, tentativeFCost);
              recordDelta('DECREASE_KEY', neighborId, {
                parentId: top.id,
                gCost: tentativeGCost,
                fCost: tentativeFCost
              }, heap.length, decSwaps, 'Relaxed path with lower cost');
            }
          }
        }

        recordDelta('CLOSE_NODE', top.id, { traversalState: 'CLOSED' }, heap.length);
        closedSet.add(top.id);
        activeNode = null;
      }
    }

    if (pathFound) {
      let curr = targetNode;
      const rev = [];
      while (curr !== null) {
        rev.push(curr);
        curr = stateMap.get(curr).parentId;
      }
      path = rev.reverse();
      pathNodeCount = path.length;
      pathEdgeCount = Math.max(0, path.length - 1);

      // Compute terrainPathCost: cumulative destination entry costs excluding START
      let terrainCost = 0;
      for (let i = 1; i < path.length; i++) {
        terrainCost += (weightMap.get(path[i]) || 1);
      }
      terrainPathCost = terrainCost;

      if (algorithm === 'BFS' || algorithm === 'DFS') {
        algorithmPathCost = pathEdgeCount;
      } else {
        algorithmPathCost = terrainCost;
      }

      // Final event: PATH_FOUND
      for (const pId of path) {
        recordDelta('PATH_FOUND', pId, { inPath: true }, 0);
      }
    } else {
      path = [];
      pathNodeCount = 0;
      pathEdgeCount = 0;
      algorithmPathCost = null;
      terrainPathCost = null;

      // Final event: NO_PATH_FOUND with reason FRONTIER_EXHAUSTED
      recordDelta('NO_PATH_FOUND', null, {}, 0, [], 'FRONTIER_EXHAUSTED');
    }

    const executionTimeMs = Math.max(0.01, Date.now() - startTime);

    const metrics = {
      pathNodeCount,
      pathEdgeCount,
      algorithmPathCost,
      terrainPathCost,
      nodesVisited: visitedCount,
      maxFrontierSize,
      executionTimeMs,
      totalSteps: traceDeltas.length
    };

    return {
      algorithm,
      pathFound,
      path,
      pathNodeCount,
      pathEdgeCount,
      algorithmPathCost,
      terrainPathCost,
      traceDeltas,
      keyframes,
      metrics,
      reversible: true,
      noPathReason: pathFound ? null : 'FRONTIER_EXHAUSTED'
    };
  }
}

module.exports = { DeterministicEngine };
