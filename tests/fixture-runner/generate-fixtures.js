const fs = require('fs');
const path = require('path');
const { DeterministicEngine } = require('./deterministic-engine');

const fixturesDir = path.resolve(__dirname, '../../contracts/fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

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
    // Wall isolating column 4
    { id: 'r0c3', row: 0, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r1c3', row: 1, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r2c3', row: 2, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r3c3', row: 3, col: 3, cellType: 'WALL', weight: 1 },
    { id: 'r4c3', row: 4, col: 3, cellType: 'WALL', weight: 1 }
  ]
};

const engine = new DeterministicEngine();

const cases = [
  { file: 'bfs.fixture.json', algo: 'BFS', grid: canonicalGrid, name: 'BFS Canonical 5x5' },
  { file: 'dfs.fixture.json', algo: 'DFS', grid: canonicalGrid, name: 'DFS Canonical 5x5' },
  { file: 'dijkstra.fixture.json', algo: 'DIJKSTRA', grid: canonicalGrid, name: 'Dijkstra Canonical 5x5' },
  { file: 'astar.fixture.json', algo: 'ASTAR', grid: canonicalGrid, name: 'A* Canonical 5x5' },
  { file: 'start-equals-target.fixture.json', algo: 'DIJKSTRA', grid: startEqualsTargetGrid, name: 'Start Equals Target' },
  { file: 'unreachable-target.fixture.json', algo: 'BFS', grid: unreachableGrid, name: 'Unreachable Target' }
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

  const filePath = path.join(fixturesDir, file);
  fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
  console.log(`Generated fixture: ${file}`);
  console.log(`  Path: ${result.path.join(' -> ') || '[NONE]'}`);
  console.log(`  Cost: algorithm=${result.algorithmPathCost}, terrain=${result.terrainPathCost}, steps=${result.traceDeltas.length}, visited=${result.metrics.nodesVisited}`);
});
