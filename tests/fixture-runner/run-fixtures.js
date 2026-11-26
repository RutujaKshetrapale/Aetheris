const fs = require('fs');
const path = require('path');
const { DeterministicEngine } = require('./deterministic-engine');

console.log('=== AETHERIS DETERMINISTIC FIXTURE TEST RUNNER ===\n');

const fixturesDir = path.resolve(__dirname, '../../contracts/fixtures');
const fixtureFiles = [
  'bfs.fixture.json',
  'dfs.fixture.json',
  'dijkstra.fixture.json',
  'astar.fixture.json',
  'start-equals-target.fixture.json',
  'unreachable-target.fixture.json'
];

const parseNodeId = (id) => {
  const match = id.match(/^r(\d+)c(\d+)$/);
  if (!match) throw new Error(`Invalid node id: ${id}`);
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
};

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

  // 8. Path Continuity & Non-Diagonal Invariant Check
  if (actual.pathFound) {
    let continuityPassed = true;
    if (actual.path.length === 1) {
      if (actual.path[0] !== fixture.grid.startNode || actual.path[0] !== fixture.grid.targetNode) {
        console.error(`  FAIL: Start equals target path must be startNode`);
        continuityPassed = false;
      }
    } else {
      if (actual.path[0] !== fixture.grid.startNode) {
        console.error(`  FAIL: Path must begin at startNode ${fixture.grid.startNode}`);
        continuityPassed = false;
      }
      if (actual.path[actual.path.length - 1] !== fixture.grid.targetNode) {
        console.error(`  FAIL: Path must terminate at targetNode ${fixture.grid.targetNode}`);
        continuityPassed = false;
      }
      for (let i = 0; i < actual.path.length - 1; i++) {
        const [r1, c1] = parseNodeId(actual.path[i]);
        const [r2, c2] = parseNodeId(actual.path[i + 1]);
        const manhattanDist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
        if (manhattanDist !== 1) {
          console.error(`  FAIL: Path continuity broken between ${actual.path[i]} and ${actual.path[i + 1]} (distance = ${manhattanDist})`);
          continuityPassed = false;
          break;
        }
        if (r1 !== r2 && c1 !== c2) {
          console.error(`  FAIL: Diagonal transition detected between ${actual.path[i]} and ${actual.path[i + 1]}`);
          continuityPassed = false;
          break;
        }
      }
    }
    if (continuityPassed) {
      console.log(`  OK: Path continuity and strictly cardinal transitions verified`);
    } else {
      testPassed = false;
    }
  }

  // 9. Physical Heap / Queue Array Forward Reconstruction and Keyframe Consistency
  const physicalFrontier = [];
  let physicalFrontierPassed = true;

  for (let i = 0; i < actual.traceDeltas.length; i++) {
    const delta = actual.traceDeltas[i];

    if (fixture.algorithm === 'DIJKSTRA' || fixture.algorithm === 'ASTAR') {
      if (delta.action === 'INITIALIZE' && delta.nodeId && delta.frontierSize > 0) {
        physicalFrontier.push(delta.nodeId);
      } else if (delta.action === 'ENQUEUE_FRONTIER' && delta.nodeId) {
        physicalFrontier.push(delta.nodeId);
        if (delta.heapSwaps) {
          for (const swap of delta.heapSwaps) {
            const temp = physicalFrontier[swap.indexA];
            physicalFrontier[swap.indexA] = physicalFrontier[swap.indexB];
            physicalFrontier[swap.indexB] = temp;
          }
        }
      } else if (delta.action === 'DECREASE_KEY') {
        if (delta.heapSwaps) {
          for (const swap of delta.heapSwaps) {
            const temp = physicalFrontier[swap.indexA];
            physicalFrontier[swap.indexA] = physicalFrontier[swap.indexB];
            physicalFrontier[swap.indexB] = temp;
          }
        }
      } else if (delta.action === 'DEQUEUE_FRONTIER') {
        if (physicalFrontier.length > 0) {
          const last = physicalFrontier.pop();
          if (physicalFrontier.length > 0) {
            physicalFrontier[0] = last;
          }
        }
        if (delta.heapSwaps) {
          for (const swap of delta.heapSwaps) {
            const temp = physicalFrontier[swap.indexA];
            physicalFrontier[swap.indexA] = physicalFrontier[swap.indexB];
            physicalFrontier[swap.indexB] = temp;
          }
        }
      }
    } else if (fixture.algorithm === 'BFS') {
      if (delta.action === 'ENQUEUE_FRONTIER' && delta.nodeId) {
        physicalFrontier.push(delta.nodeId);
      } else if (delta.action === 'DEQUEUE_FRONTIER') {
        physicalFrontier.shift();
      }
    } else if (fixture.algorithm === 'DFS') {
      if (delta.action === 'ENQUEUE_FRONTIER' && delta.nodeId) {
        physicalFrontier.push(delta.nodeId);
      } else if (delta.action === 'DEQUEUE_FRONTIER') {
        physicalFrontier.pop();
      }
    }

    // Verify keyframe match if keyframe was recorded at this step
    if (delta.step % 50 === 0 && actual.keyframes) {
      const kf = actual.keyframes.find(k => k.step === delta.step);
      if (kf) {
        const kfFrontierMatch = JSON.stringify(kf.frontier) === JSON.stringify(physicalFrontier);
        if (!kfFrontierMatch) {
          console.error(`  FAIL: Physical frontier array mismatch with keyframe at step ${delta.step}`);
          console.error(`    Keyframe frontier: ${kf.frontier.join(', ')}`);
          console.error(`    Physical frontier: ${physicalFrontier.join(', ')}`);
          physicalFrontierPassed = false;
          break;
        }
      }
    }

    // For BFS and DFS, startNode enters the queue/stack after step 0 initialization
    if ((fixture.algorithm === 'BFS' || fixture.algorithm === 'DFS') && delta.action === 'INITIALIZE' && delta.nodeId && delta.frontierSize > 0) {
      physicalFrontier.push(delta.nodeId);
    }
  }

  if (physicalFrontierPassed) {
    console.log(`  OK: Physical heap/queue array physical reconstruction matches keyframes across all steps`);
  } else {
    testPassed = false;
  }

  // 10. Verify Bidirectional Reversibility Invariant (Full restoration to initial state)
  const stateMap = new Map();
  for (let r = 0; r < fixture.grid.rows; r++) {
    for (let c = 0; c < fixture.grid.cols; c++) {
      const id = `r${r}c${c}`;
      let cellType = 'EMPTY';
      if (id === fixture.grid.targetNode) cellType = 'TARGET';
      if (id === fixture.grid.startNode) cellType = 'START';

      const custom = fixture.grid.cells ? fixture.grid.cells.find(cell => cell.id === id) : null;
      if (custom && custom.cellType) cellType = custom.cellType;

      stateMap.set(id, {
        cellType,
        traversalState: 'UNVISITED',
        inPath: false,
        gCost: null,
        hCost: null,
        fCost: null,
        parentId: null
      });
    }
  }

  // Deep clone initial state map
  const initialSnapshots = new Map();
  for (const [id, s] of stateMap.entries()) {
    initialSnapshots.set(id, { ...s });
  }

  // Apply deltas forward
  let forwardOk = true;
  for (let i = 0; i < actual.traceDeltas.length; i++) {
    const delta = actual.traceDeltas[i];
    if (delta.nodeId && delta.afterState) {
      stateMap.set(delta.nodeId, { ...delta.afterState });
    }
  }

  // Verify that the final state matches the path overlay
  for (const pNode of actual.path) {
    const s = stateMap.get(pNode);
    if (!s || !s.inPath) {
      console.error(`  FAIL: Path node ${pNode} not marked inPath in final state`);
      forwardOk = false;
      break;
    }
  }

  if (forwardOk) {
    console.log(`  OK: Forward delta replay produced expected final state`);
  } else {
    testPassed = false;
  }

  // Step backwards: apply beforeState in reverse
  let backwardOk = true;
  for (let i = actual.traceDeltas.length - 1; i >= 0; i--) {
    const delta = actual.traceDeltas[i];
    if (delta.nodeId && delta.beforeState) {
      stateMap.set(delta.nodeId, { ...delta.beforeState });
    }
  }

  // Check that current state matches initialSnapshots exactly
  for (const [id, initialS] of initialSnapshots.entries()) {
    const currS = stateMap.get(id);
    if (JSON.stringify(currS) !== JSON.stringify(initialS)) {
      console.error(`  FAIL: Reversibility restoration failed at cell ${id}`);
      console.error(`    Expected:`, initialS);
      console.error(`    Current: `, currS);
      backwardOk = false;
      break;
    }
  }

  if (backwardOk) {
    console.log(`  OK: Reversible trace delta symmetry verified: full restoration of initial state`);
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
