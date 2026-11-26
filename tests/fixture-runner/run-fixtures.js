const fs = require('fs');
const path = require('path');
const { DeterministicEngine } = require('./deterministic-engine');

console.log('=== AETHERIS DETERMINISTIC FIXTURE TEST RUNNER (PHASE 2) ===\n');

const fixturesDir = fs.existsSync(path.resolve(__dirname, '../../contracts/fixtures/pathfinding'))
  ? path.resolve(__dirname, '../../contracts/fixtures/pathfinding')
  : path.resolve(__dirname, '../../contracts/fixtures');

const fixtureFiles = fs.readdirSync(fixturesDir)
  .filter(f => f.endsWith('.fixture.json'))
  .sort();

/**
 * Independent Playback State Model
 * Encapsulates the entire algorithmic engine state independently from the engine itself:
 * - Every grid cell across its 3 layers (terrain, traversal, path)
 * - Parent pointers, gCost, hCost, fCost
 * - Active node
 * - Closed set
 * - Physical frontier (queue, stack, or indexed min-heap array + indexMap + priorities)
 * - Path & metrics
 */
class IndependentPlaybackState {
  constructor(grid, algorithm) {
    this.rows = grid.rows;
    this.cols = grid.cols;
    this.startNode = grid.startNode;
    this.targetNode = grid.targetNode;
    this.algorithm = algorithm;

    this.cells = new Map();
    this.activeNode = null;
    this.closedSet = new Set();
    this.physicalFrontier = []; // queue (BFS), stack (DFS), or physical heap array (Dijkstra/A*)
    this.heapIndexMap = new Map();
    this.heapPriorities = new Map();
    this.path = [];
    this.nodesVisited = 0;
    this.maxFrontierSize = 0;

    // History stacks for reversible playback
    this.activeNodeHistory = [];
    this.dequeuedNodesHistory = [];

    // Initialize cells
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const id = `r${r}c${c}`;
        let cellType = 'EMPTY';
        let weight = 1;
        if (id === grid.targetNode) cellType = 'TARGET';
        if (id === grid.startNode) cellType = 'START';

        const custom = grid.cells ? grid.cells.find(cell => cell.id === id) : null;
        if (custom) {
          if (custom.cellType) cellType = custom.cellType;
          if (custom.weight) weight = custom.weight;
        }

        this.cells.set(id, {
          // Layer 1: Static Terrain
          cellType,
          weight,
          // Layer 2: Traversal State & Costs
          traversalState: 'UNVISITED',
          parentId: null,
          gCost: null,
          hCost: null,
          fCost: null,
          // Layer 3: Path overlay
          inPath: false
        });
      }
    }
  }

  cloneSnapshot() {
    const cellsCopy = new Map();
    for (const [id, c] of this.cells.entries()) {
      cellsCopy.set(id, { ...c });
    }
    return {
      cells: cellsCopy,
      activeNode: this.activeNode,
      closedSet: new Set(this.closedSet),
      physicalFrontier: [...this.physicalFrontier],
      heapIndexMap: new Map(this.heapIndexMap),
      heapPriorities: new Map(this.heapPriorities),
      path: [...this.path],
      nodesVisited: this.nodesVisited,
      maxFrontierSize: this.maxFrontierSize
    };
  }

  applyForward(delta) {
    // 1. Update cell state if present
    if (delta.nodeId && delta.afterState) {
      const cell = this.cells.get(delta.nodeId);
      if (cell) {
        cell.traversalState = delta.afterState.traversalState;
        cell.inPath = delta.afterState.inPath;
        cell.gCost = delta.afterState.gCost;
        cell.hCost = delta.afterState.hCost;
        cell.fCost = delta.afterState.fCost;
        cell.parentId = delta.afterState.parentId;
      }
    }

    // 2. Action transitions
    switch (delta.action) {
      case 'INITIALIZE':
        if (delta.nodeId && delta.frontierSize > 0) {
          if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
            this.physicalFrontier.push(delta.nodeId);
            this.heapIndexMap.set(delta.nodeId, 0);
            this.heapPriorities.set(delta.nodeId, {
              g: delta.afterState?.gCost ?? 0,
              h: delta.afterState?.hCost ?? 0,
              f: delta.afterState?.fCost ?? 0
            });
            this.maxFrontierSize = Math.max(this.maxFrontierSize, this.physicalFrontier.length);
          }
        }
        break;

      case 'EXAMINE_NODE':
        this.activeNodeHistory.push(this.activeNode);
        this.activeNode = delta.nodeId;
        this.nodesVisited++;
        break;

      case 'ENQUEUE_FRONTIER':
        if (delta.operationSubtype === 'DECREASE_KEY') {
          // Decrease-key heap swaps
          if (delta.heapSwaps) {
            for (const swap of delta.heapSwaps) {
              const temp = this.physicalFrontier[swap.indexA];
              this.physicalFrontier[swap.indexA] = this.physicalFrontier[swap.indexB];
              this.physicalFrontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.physicalFrontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.physicalFrontier[swap.indexB], swap.indexB);
            }
          }
          if (delta.nodeId && delta.afterState) {
            this.heapPriorities.set(delta.nodeId, {
              g: delta.afterState.gCost,
              h: delta.afterState.hCost,
              f: delta.afterState.fCost
            });
          }
        } else {
          // Normal enqueue
          if (delta.nodeId) {
            this.physicalFrontier.push(delta.nodeId);
            if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
              this.heapIndexMap.set(delta.nodeId, this.physicalFrontier.length - 1);
              this.heapPriorities.set(delta.nodeId, {
                g: delta.afterState?.gCost ?? 0,
                h: delta.afterState?.hCost ?? 0,
                f: delta.afterState?.fCost ?? 0
              });
              if (delta.heapSwaps) {
                for (const swap of delta.heapSwaps) {
                  const temp = this.physicalFrontier[swap.indexA];
                  this.physicalFrontier[swap.indexA] = this.physicalFrontier[swap.indexB];
                  this.physicalFrontier[swap.indexB] = temp;
                  this.heapIndexMap.set(this.physicalFrontier[swap.indexA], swap.indexA);
                  this.heapIndexMap.set(this.physicalFrontier[swap.indexB], swap.indexB);
                }
              }
            }
            this.maxFrontierSize = Math.max(this.maxFrontierSize, this.physicalFrontier.length);
          }
        }
        break;

      case 'DEQUEUE_FRONTIER':
        if (this.algorithm === 'BFS') {
          const removed = this.physicalFrontier.shift();
          this.dequeuedNodesHistory.push(removed);
        } else if (this.algorithm === 'DFS') {
          const removed = this.physicalFrontier.pop();
          this.dequeuedNodesHistory.push(removed);
        } else {
          // Dijkstra / A*
          if (this.physicalFrontier.length > 0) {
            const root = this.physicalFrontier[0];
            const last = this.physicalFrontier.pop();
            this.dequeuedNodesHistory.push({ root, last: this.physicalFrontier.length > 0 ? last : null });
            this.heapIndexMap.delete(root);
            if (this.physicalFrontier.length > 0) {
              this.physicalFrontier[0] = last;
              this.heapIndexMap.set(last, 0);
            }
          }
          if (delta.heapSwaps) {
            for (const swap of delta.heapSwaps) {
              const temp = this.physicalFrontier[swap.indexA];
              this.physicalFrontier[swap.indexA] = this.physicalFrontier[swap.indexB];
              this.physicalFrontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.physicalFrontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.physicalFrontier[swap.indexB], swap.indexB);
            }
          }
        }
        break;

      case 'CLOSE_NODE':
        if (delta.nodeId) {
          this.closedSet.add(delta.nodeId);
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
        this.path = [];
        break;

      case 'UPDATE_METRICS':
        break;
    }
  }

  applyInverse(delta) {
    // 1. Invert cell state if present
    if (delta.nodeId && delta.beforeState) {
      const cell = this.cells.get(delta.nodeId);
      if (cell) {
        cell.traversalState = delta.beforeState.traversalState;
        cell.inPath = delta.beforeState.inPath;
        cell.gCost = delta.beforeState.gCost;
        cell.hCost = delta.beforeState.hCost;
        cell.fCost = delta.beforeState.fCost;
        cell.parentId = delta.beforeState.parentId;
      }
    }

    // 2. Invert action transitions in exact reverse order
    switch (delta.action) {
      case 'INITIALIZE':
        if (delta.nodeId && delta.frontierSize > 0) {
          this.physicalFrontier.pop();
          if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
            this.heapIndexMap.delete(delta.nodeId);
            this.heapPriorities.delete(delta.nodeId);
          }
        }
        break;

      case 'EXAMINE_NODE':
        this.activeNode = this.activeNodeHistory.pop() ?? null;
        this.nodesVisited--;
        break;

      case 'ENQUEUE_FRONTIER':
        if (delta.operationSubtype === 'DECREASE_KEY') {
          // Reverse heap swaps in reverse order
          if (delta.heapSwaps) {
            for (let s = delta.heapSwaps.length - 1; s >= 0; s--) {
              const swap = delta.heapSwaps[s];
              const temp = this.physicalFrontier[swap.indexA];
              this.physicalFrontier[swap.indexA] = this.physicalFrontier[swap.indexB];
              this.physicalFrontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.physicalFrontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.physicalFrontier[swap.indexB], swap.indexB);
            }
          }
          if (delta.nodeId && delta.beforeState) {
            this.heapPriorities.set(delta.nodeId, {
              g: delta.beforeState.gCost,
              h: delta.beforeState.hCost,
              f: delta.beforeState.fCost
            });
          }
        } else {
          // Reverse normal enqueue
          if (this.algorithm === 'DIJKSTRA' || this.algorithm === 'ASTAR') {
            if (delta.heapSwaps) {
              for (let s = delta.heapSwaps.length - 1; s >= 0; s--) {
                const swap = delta.heapSwaps[s];
                const temp = this.physicalFrontier[swap.indexA];
                this.physicalFrontier[swap.indexA] = this.physicalFrontier[swap.indexB];
                this.physicalFrontier[swap.indexB] = temp;
                this.heapIndexMap.set(this.physicalFrontier[swap.indexA], swap.indexA);
                this.heapIndexMap.set(this.physicalFrontier[swap.indexB], swap.indexB);
              }
            }
            if (delta.nodeId) {
              this.physicalFrontier.pop();
              this.heapIndexMap.delete(delta.nodeId);
              this.heapPriorities.delete(delta.nodeId);
            }
          } else {
            this.physicalFrontier.pop();
          }
        }
        break;

      case 'DEQUEUE_FRONTIER':
        if (this.algorithm === 'BFS') {
          const prev = this.dequeuedNodesHistory.pop();
          if (prev) this.physicalFrontier.unshift(prev);
        } else if (this.algorithm === 'DFS') {
          const prev = this.dequeuedNodesHistory.pop();
          if (prev) this.physicalFrontier.push(prev);
        } else {
          // Dijkstra / A*
          if (delta.heapSwaps) {
            for (let s = delta.heapSwaps.length - 1; s >= 0; s--) {
              const swap = delta.heapSwaps[s];
              const temp = this.physicalFrontier[swap.indexA];
              this.physicalFrontier[swap.indexA] = this.physicalFrontier[swap.indexB];
              this.physicalFrontier[swap.indexB] = temp;
              this.heapIndexMap.set(this.physicalFrontier[swap.indexA], swap.indexA);
              this.heapIndexMap.set(this.physicalFrontier[swap.indexB], swap.indexB);
            }
          }
          const info = this.dequeuedNodesHistory.pop();
          if (info) {
            if (info.last !== null) {
              this.physicalFrontier[0] = info.root;
              this.heapIndexMap.set(info.root, 0);
              this.physicalFrontier.push(info.last);
              this.heapIndexMap.set(info.last, this.physicalFrontier.length - 1);
            } else {
              this.physicalFrontier.push(info.root);
              this.heapIndexMap.set(info.root, 0);
            }
          }
        }
        break;

      case 'CLOSE_NODE':
        if (delta.nodeId) {
          this.closedSet.delete(delta.nodeId);
          this.activeNode = this.activeNodeHistory.pop() ?? null;
        }
        break;

      case 'PATH_FOUND':
        this.path.pop();
        break;

      case 'NO_PATH_FOUND':
        break;

      case 'UPDATE_METRICS':
        break;
    }
  }
}

const engine = new DeterministicEngine();
let passCount = 0;
let failCount = 0;

for (const file of fixtureFiles) {
  const filePath = path.join(fixturesDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: Missing fixture ${file}`);
    failCount++;
    continue;
  }

  const fixture = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`[TEST] Algorithm: ${fixture.algorithm} (${file})`);

  // Run engine
  const actual = engine.run(fixture.algorithm, fixture.grid);
  const expected = fixture.expectedOutcome;

  let testPassed = true;

  // 1. Path Found
  if (actual.pathFound !== expected.pathFound) {
    console.error(`  FAIL: pathFound expected ${expected.pathFound}, got ${actual.pathFound}`);
    testPassed = false;
  } else {
    console.log(`  OK: pathFound matches (${actual.pathFound})`);
  }

  // 2. Path exact match
  const pathMatch = JSON.stringify(actual.path) === JSON.stringify(expected.path);
  if (!pathMatch) {
    console.error(`  FAIL: Path mismatch`);
    console.error(`    Expected: ${expected.path.join(' -> ')}`);
    console.error(`    Actual:   ${actual.path.join(' -> ')}`);
    testPassed = false;
  } else {
    console.log(`  OK: Path exact match (${actual.path.join(' -> ') || '[NONE]'})`);
  }

  // 3. Path Counts
  if (actual.pathNodeCount !== expected.pathNodeCount || actual.pathEdgeCount !== expected.pathEdgeCount) {
    console.error(`  FAIL: Path counts mismatch. Expected nodes=${expected.pathNodeCount}, edges=${expected.pathEdgeCount}; got nodes=${actual.pathNodeCount}, edges=${actual.pathEdgeCount}`);
    testPassed = false;
  } else {
    console.log(`  OK: Path counts match (nodes=${actual.pathNodeCount}, edges=${actual.pathEdgeCount})`);
  }

  // 4. Algorithm & Terrain Path Costs
  if (actual.algorithmPathCost !== expected.algorithmPathCost || actual.terrainPathCost !== expected.terrainPathCost) {
    console.error(`  FAIL: Path costs mismatch. Expected algo=${expected.algorithmPathCost}, terrain=${expected.terrainPathCost}; got algo=${actual.algorithmPathCost}, terrain=${actual.terrainPathCost}`);
    testPassed = false;
  } else {
    console.log(`  OK: Path costs match (algorithm=${actual.algorithmPathCost}, terrain=${actual.terrainPathCost})`);
  }

  // 5. Nodes Visited
  if (actual.metrics.nodesVisited !== expected.nodesVisited) {
    console.error(`  FAIL: Nodes visited expected ${expected.nodesVisited}, got ${actual.metrics.nodesVisited}`);
    testPassed = false;
  } else {
    console.log(`  OK: Nodes visited matches (${actual.metrics.nodesVisited})`);
  }

  // 6. Total Trace Deltas
  if (actual.traceDeltas.length !== expected.totalSteps) {
    console.error(`  FAIL: Total steps expected ${expected.totalSteps}, got ${actual.traceDeltas.length}`);
    testPassed = false;
  } else {
    console.log(`  OK: Total steps match (${actual.traceDeltas.length})`);
  }

  // 7. No Path Reason
  if (actual.noPathReason !== expected.noPathReason) {
    console.error(`  FAIL: noPathReason expected ${expected.noPathReason}, got ${actual.noPathReason}`);
    testPassed = false;
  } else {
    console.log(`  OK: noPathReason matches (${actual.noPathReason})`);
  }

  // 8. Keyframe Interval (every 50 steps: 0, 50, 100...)
  const expectedKeyframeSteps = [];
  for (let s = 0; s < actual.traceDeltas.length; s += 50) {
    expectedKeyframeSteps.push(s);
  }
  const actualKeyframeSteps = actual.keyframes.map(k => k.step);
  const keyframesMatch = JSON.stringify(expectedKeyframeSteps) === JSON.stringify(actualKeyframeSteps);
  if (!keyframesMatch) {
    console.error(`  FAIL: Keyframe step cadence mismatch.`);
    console.error(`    Expected steps: ${expectedKeyframeSteps.join(', ')}`);
    console.error(`    Actual steps:   ${actualKeyframeSteps.join(', ')}`);
    testPassed = false;
  } else {
    console.log(`  OK: Keyframe step cadence matches 50-step invariant (${actualKeyframeSteps.join(', ')})`);
  }

  // 9. Independent Playback State Model: Forward Replay & Keyframe Validation
  const playback = new IndependentPlaybackState(fixture.grid, fixture.algorithm);
  const initialSnapshot = playback.cloneSnapshot();

  let forwardPassed = true;
  for (let i = 0; i < actual.traceDeltas.length; i++) {
    const delta = actual.traceDeltas[i];
    playback.applyForward(delta);

    // Validate keyframe if step % 50 === 0
    if (delta.step % 50 === 0 && actual.keyframes) {
      const kf = actual.keyframes.find(k => k.step === delta.step);
      if (kf) {
        // A. Frontier array match
        const frontierMatch = JSON.stringify(kf.frontier) === JSON.stringify(playback.physicalFrontier);
        if (!frontierMatch) {
          console.error(`  FAIL: Keyframe frontier mismatch at step ${delta.step}`);
          console.error(`    Keyframe:`, kf.frontier);
          console.error(`    Playback:`, playback.physicalFrontier);
          forwardPassed = false;
          break;
        }

        // B. Closed count match
        if (kf.closedCount !== playback.closedSet.size) {
          console.error(`  FAIL: Keyframe closedCount mismatch at step ${delta.step}. Expected ${playback.closedSet.size}, got ${kf.closedCount}`);
          forwardPassed = false;
          break;
        }

        // C. Cell states match
        for (const [cellId, cell] of playback.cells.entries()) {
          const kfCell = kf.cellStates[cellId];
          if (!kfCell) {
            console.error(`  FAIL: Missing cell ${cellId} in keyframe at step ${delta.step}`);
            forwardPassed = false;
            break;
          }
          if (kfCell.traversalState !== cell.traversalState || kfCell.inPath !== cell.inPath) {
            console.error(`  FAIL: Cell state mismatch for ${cellId} at keyframe step ${delta.step}`);
            forwardPassed = false;
            break;
          }
        }
      }
    }

    if (delta.action === 'INITIALIZE' && (fixture.algorithm === 'BFS' || fixture.algorithm === 'DFS') && delta.nodeId && delta.frontierSize > 0) {
      playback.physicalFrontier.push(delta.nodeId);
      playback.maxFrontierSize = Math.max(playback.maxFrontierSize, playback.physicalFrontier.length);
    }
  }

  if (forwardPassed) {
    console.log(`  OK: Independent playback state forward pass matches all keyframes and physical data structures`);
  } else {
    testPassed = false;
  }

  // 10. Independent Playback State Model: Backward Replay & 100% Initial State Restoration
  let backwardPassed = true;
  for (let i = actual.traceDeltas.length - 1; i >= 0; i--) {
    const delta = actual.traceDeltas[i];
    playback.applyInverse(delta);
  }

  // Assert 100% initial state restoration:
  // A. Every cell across 3 layers matches initial snapshot
  for (const [id, initialCell] of initialSnapshot.cells.entries()) {
    const restoredCell = playback.cells.get(id);
    if (JSON.stringify(restoredCell) !== JSON.stringify(initialCell)) {
      console.error(`  FAIL: Cell restoration failure at ${id}`);
      console.error(`    Expected:`, initialCell);
      console.error(`    Restored:`, restoredCell);
      backwardPassed = false;
      break;
    }
  }

  // B. Active node restored to null
  if (playback.activeNode !== null) {
    console.error(`  FAIL: Active node not restored to null (got ${playback.activeNode})`);
    backwardPassed = false;
  }

  // C. Closed set restored to empty
  if (playback.closedSet.size !== 0) {
    console.error(`  FAIL: Closed set not restored to empty (size=${playback.closedSet.size})`);
    backwardPassed = false;
  }

  // D. Physical frontier restored to empty
  if (playback.physicalFrontier.length !== 0) {
    console.error(`  FAIL: Physical frontier not restored to empty (${playback.physicalFrontier.join(', ')})`);
    backwardPassed = false;
  }

  // E. Heap index map and priorities restored to empty
  if (playback.heapIndexMap.size !== 0) {
    console.error(`  FAIL: Heap index map not restored to empty (size=${playback.heapIndexMap.size})`);
    backwardPassed = false;
  }
  if (playback.heapPriorities.size !== 0) {
    console.error(`  FAIL: Heap priorities not restored to empty (size=${playback.heapPriorities.size})`);
    backwardPassed = false;
  }

  // F. Path restored to empty
  if (playback.path.length !== 0) {
    console.error(`  FAIL: Path not restored to empty (${playback.path.join(', ')})`);
    backwardPassed = false;
  }

  // G. Nodes visited restored to 0
  if (playback.nodesVisited !== 0) {
    console.error(`  FAIL: Nodes visited not restored to 0 (got ${playback.nodesVisited})`);
    backwardPassed = false;
  }

  if (backwardPassed) {
    console.log(`  OK: Complete reversible playback verified: 100% initial state restoration across all layers and engine structures`);
  } else {
    testPassed = false;
  }

  if (testPassed) {
    console.log(`  RESULT: PASSED\n`);
    passCount++;
  } else {
    console.log(`  RESULT: FAILED\n`);
    failCount++;
  }
}

console.log('=====================================================');
console.log(`FIXTURE RUNNER SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
if (failCount === 0) {
  process.exit(0);
} else {
  process.exit(1);
}
