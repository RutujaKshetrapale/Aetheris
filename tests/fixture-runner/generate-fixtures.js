const fs = require('fs');
const path = require('path');
const { DeterministicEngine } = require('./deterministic-engine');

const fixturesDir = path.resolve(__dirname, '../../contracts/fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Canonical Test Grid (5x5)
const canonicalGrid = {
  rows: 5,
  cols: 5,
  startNode: 'r0c0',
  targetNode: 'r4c4',
  cells: [
    { id: 'r0c0', row: 0, col: 0, cellType: 'START', weight: 1.0 },
    { id: 'r4c4', row: 4, col: 4, cellType: 'TARGET', weight: 1.0 },
    // Wall barrier in column 2 (rows 1, 2, 3)
    { id: 'r1c2', row: 1, col: 2, cellType: 'WALL', weight: 1.0 },
    { id: 'r2c2', row: 2, col: 2, cellType: 'WALL', weight: 1.0 },
    { id: 'r3c2', row: 3, col: 2, cellType: 'WALL', weight: 1.0 },
    // Weighted passage at r0c2 with cost 5.0
    { id: 'r0c2', row: 0, col: 2, cellType: 'WEIGHTED', weight: 5.0 }
  ]
};

const engine = new DeterministicEngine();
const algorithms = ['BFS', 'DFS', 'DIJKSTRA', 'ASTAR'];

algorithms.forEach((algo) => {
  const result = engine.run(algo, canonicalGrid);

  const fixture = {
    id: `fixture-${algo.toLowerCase()}-canonical-5x5`,
    name: `${algo} Deterministic Canonical 5x5 Test Fixture`,
    description: `Deterministic ground truth fixture for ${algo} pathfinding on 5x5 obstacle grid`,
    algorithm: algo,
    grid: canonicalGrid,
    expectedOutcome: {
      pathFound: result.pathFound,
      path: result.path,
      pathCost: result.pathCost,
      pathLength: result.path.length,
      nodesVisited: result.metrics.nodesVisited,
      maxFrontierSize: result.metrics.maxFrontierSize,
      totalTraceDeltas: result.traceDeltas.length
    },
    // Include full expected trace deltas for exact byte-by-byte verification
    traceDeltas: result.traceDeltas
  };

  const filePath = path.join(fixturesDir, `${algo.toLowerCase()}.fixture.json`);
  fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
  console.log(`Generated fixture: ${algo.toLowerCase()}.fixture.json (pathLength: ${result.path.length}, cost: ${result.pathCost}, deltas: ${result.traceDeltas.length}, visited: ${result.metrics.nodesVisited})`);
  console.log(`  Path: ${result.path.join(' -> ')}`);
});
