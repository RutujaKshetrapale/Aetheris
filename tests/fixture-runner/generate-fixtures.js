const fs = require('fs');
const path = require('path');
const { DeterministicEngine } = require('./deterministic-engine');

const fixturesDir = path.resolve(__dirname, '../../contracts/fixtures');
const pathfindingDir = path.resolve(__dirname, '../../contracts/fixtures/pathfinding');

[fixturesDir, pathfindingDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 1. Canonical 5x5 Benchmark Grid with integer weights
const canonicalGrid = {
  rows: 5,
  cols: 5,
  startNode: 'r0c0',
  targetNode: 'r4c4',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'TARGET', weight: 1 },
    { id: 'r1c2', row: 1, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r3c2', row: 3, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r0c2', row: 0, col: 2, cellType: 'WEIGHTED', weight: 5 }
  ]
};

// 2. Start equals target Grid
const startEqualsTargetGrid = {
  rows: 5,
  cols: 5,
  startNode: 'r2c2',
  targetNode: 'r2c2',
  cells: [
    { id: 'r2c2', row: 2, col: 2, cellType: 'START', weight: 1 }
  ]
};

// 3. Unreachable target Grid
const unreachableGrid = {
  rows: 5,
  cols: 5,
  startNode: 'r0c0',
  targetNode: 'r4c4',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'TARGET', weight: 1 },
    { id: 'r0c3', row: 0, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r1c3', row: 1, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r2c3', row: 2, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r3c3', row: 3, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r4c3', row: 4, col: 3, cellType: 'WALL', weight: 1 }
  ]
};

// 4. Target immediately adjacent to start (distance 1)
const adjacentGrid = {
  rows: 3,
  cols: 3,
  startNode: 'r1c1',
  targetNode: 'r1c2',
  cells: [
    { id: 'r1c1', row: 1, col: 1, cellType: 'START', weight: 1 },
    { id: 'r1c2', row: 1, col: 2, cellType: 'TARGET', weight: 1 }
  ]
};

// 5. Completely blocked grid
const completelyBlockedGrid = {
  rows: 3,
  cols: 3,
  startNode: 'r1c1',
  targetNode: 'r0c0',
  cells: [
    { id: 'r1c1', row: 1, col: 1, cellType: 'START', weight: 1 },
    { id: 'r0c0', row: 0, col: 0, cellType: 'TARGET', weight: 1 },
    { id: 'r0c1', row: 0, col: 1, cellType: 'WALL', weight: 1 },
    { id: 'r1c0', row: 1, col: 0, cellType: 'WALL', weight: 1 },
    { id: 'r1c2', row: 1, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r2c1', row: 2, col: 1, cellType: 'WALL', weight: 1 }
  ]
};

// 6. One-row grid (1x5)
const oneRowGrid = {
  rows: 1,
  cols: 5,
  startNode: 'r0c0',
  targetNode: 'r0c4',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r0c4', row: 0, col: 4, cellType: 'TARGET', weight: 1 }
  ]
};

// 7. One-column grid (5x1)
const oneColumnGrid = {
  rows: 5,
  cols: 1,
  startNode: 'r0c0',
  targetNode: 'r4c0',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r4c0', row: 4, col: 0, cellType: 'TARGET', weight: 1 }
  ]
};

// 8. Multiple equal paths grid (3x3 open)
const multipleEqualPathsGrid = {
  rows: 3,
  cols: 3,
  startNode: 'r0c0',
  targetNode: 'r2c2',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'TARGET', weight: 1 }
  ]
};

// 9. Weighted route divergence grid (3x5)
// Direct path (row 1) has high weights (15 each, total terrain cost = 47).
// Bypass path (row 0) has weight 1 cells (total terrain cost = 5).
const weightedDivergenceGrid = {
  rows: 3,
  cols: 5,
  startNode: 'r1c0',
  targetNode: 'r1c4',
  cells: [
    { id: 'r1c0', row: 1, col: 0, cellType: 'START', weight: 1 },
    { id: 'r1c4', row: 1, col: 4, cellType: 'TARGET', weight: 1 },
    { id: 'r1c1', row: 1, col: 1, cellType: 'WEIGHTED', weight: 15 },
    { id: 'r1c2', row: 1, col: 2, cellType: 'WEIGHTED', weight: 15 },
    { id: 'r1c3', row: 1, col: 3, cellType: 'WEIGHTED', weight: 15 },
    // Row 2 blocked so bypass MUST be row 0
    { id: 'r2c0', row: 2, col: 0, cellType: 'WALL', weight: 1 },
    { id: 'r2c1', row: 2, col: 1, cellType: 'WALL', weight: 1 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1 },
    { id: 'r2c3', row: 2, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r2c4', row: 2, col: 4, cellType: 'WALL', weight: 1 }
  ]
};

// 10. Repeated decrease-key grid
const repeatedDecreaseKeyGrid = {
  rows: 3,
  cols: 3,
  startNode: 'r0c0',
  targetNode: 'r2c2',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'TARGET', weight: 1 },
    // r0c1 has high weight 20, r1c0 has weight 2
    { id: 'r0c1', row: 0, col: 1, cellType: 'WEIGHTED', weight: 20 },
    { id: 'r1c0', row: 1, col: 0, cellType: 'WEIGHTED', weight: 2 },
    // r1c1 has weight 1
    { id: 'r1c1', row: 1, col: 1, cellType: 'WEIGHTED', weight: 2 }
  ]
};

// 11. Large 12x12 maze grid
const largeMazeCells = [
  { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1 },
  { id: 'r11c11', row: 11, col: 11, cellType: 'TARGET', weight: 1 }
];
// Add obstacles in large grid
for (let r = 1; r < 11; r += 2) {
  for (let c = 0; c < 10; c++) {
    largeMazeCells.push({ id: `r${r}c${c}`, row: r, col: c, cellType: 'WALL', weight: 1 });
  }
}
const largeGrid = {
  rows: 12,
  cols: 12,
  startNode: 'r0c0',
  targetNode: 'r11c11',
  cells: largeMazeCells
};

const engine = new DeterministicEngine();

const cases = [
  { file: 'bfs.fixture.json', algo: 'BFS', grid: canonicalGrid, name: 'BFS Canonical 5x5' },
  { file: 'dfs.fixture.json', algo: 'DFS', grid: canonicalGrid, name: 'DFS Canonical 5x5' },
  { file: 'dijkstra.fixture.json', algo: 'DIJKSTRA', grid: canonicalGrid, name: 'Dijkstra Canonical 5x5' },
  { file: 'astar.fixture.json', algo: 'ASTAR', grid: canonicalGrid, name: 'A* Canonical 5x5' },
  { file: 'start-equals-target.fixture.json', algo: 'DIJKSTRA', grid: startEqualsTargetGrid, name: 'Start Equals Target' },
  { file: 'unreachable-target.fixture.json', algo: 'BFS', grid: unreachableGrid, name: 'Unreachable Target' },
  { file: 'adjacent-target.fixture.json', algo: 'BFS', grid: adjacentGrid, name: 'Target Immediately Adjacent' },
  { file: 'completely-blocked.fixture.json', algo: 'BFS', grid: completelyBlockedGrid, name: 'Completely Blocked Grid' },
  { file: 'one-row.fixture.json', algo: 'BFS', grid: oneRowGrid, name: 'One Row Grid Corridor' },
  { file: 'one-column.fixture.json', algo: 'DFS', grid: oneColumnGrid, name: 'One Column Grid Corridor' },
  { file: 'multiple-equal-paths.fixture.json', algo: 'BFS', grid: multipleEqualPathsGrid, name: 'Multiple Equal Shortest Paths (Tie-Breaking)' },
  { file: 'weighted-divergence-bfs.fixture.json', algo: 'BFS', grid: weightedDivergenceGrid, name: 'Weighted Divergence - BFS (Hops Priority)' },
  { file: 'weighted-divergence-dijkstra.fixture.json', algo: 'DIJKSTRA', grid: weightedDivergenceGrid, name: 'Weighted Divergence - Dijkstra (Terrain Cost Priority)' },
  { file: 'weighted-divergence-astar.fixture.json', algo: 'ASTAR', grid: weightedDivergenceGrid, name: 'Weighted Divergence - A* (Terrain Cost Priority)' },
  { file: 'repeated-decrease-key.fixture.json', algo: 'DIJKSTRA', grid: repeatedDecreaseKeyGrid, name: 'Repeated Decrease-Key Edge Relaxation' },
  { file: 'large-grid.fixture.json', algo: 'ASTAR', grid: largeGrid, name: 'Large 12x12 Maze Grid' }
];

cases.forEach(({ file, algo, grid, name }) => {
  const result = engine.run(algo, grid);

  const fixture = {
    id: `fixture-${file.replace('.fixture.json', '')}`,
    name,
    algorithm: algo,
    grid,
    expectedOutcome: {
      pathFound: result.pathFound,
      path: result.path,
      pathNodeCount: result.pathNodeCount,
      pathEdgeCount: result.pathEdgeCount,
      algorithmPathCost: result.algorithmPathCost,
      terrainPathCost: result.terrainPathCost,
      nodesVisited: result.metrics.nodesVisited,
      maxFrontierSize: result.metrics.maxFrontierSize,
      totalSteps: result.traceDeltas.length,
      noPathReason: result.noPathReason
    },
    traceDeltas: result.traceDeltas,
    keyframes: result.keyframes
  };

  const content = JSON.stringify(fixture, null, 2);
  fs.writeFileSync(path.join(fixturesDir, file), content, 'utf-8');
  fs.writeFileSync(path.join(pathfindingDir, file), content, 'utf-8');

  console.log(`Generated: ${file}`);
  console.log(`  Path: ${result.path.join(' -> ') || '[NONE]'}`);
  console.log(`  Cost: algorithm=${result.algorithmPathCost}, terrain=${result.terrainPathCost}, steps=${result.traceDeltas.length}, visited=${result.metrics.nodesVisited}`);
});
console.log(`\nSuccessfully generated ${cases.length} canonical fixtures in both fixtures/ and fixtures/pathfinding/!`);
