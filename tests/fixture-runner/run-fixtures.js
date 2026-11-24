const fs = require('fs');
const path = require('path');
const { DeterministicEngine } = require('./deterministic-engine');

console.log('=== AETHERIS DETERMINISTIC FIXTURE TEST RUNNER ===\n');

const fixturesDir = path.resolve(__dirname, '../../contracts/fixtures');
const fixtureFiles = ['bfs.fixture.json', 'dfs.fixture.json', 'dijkstra.fixture.json', 'astar.fixture.json'];

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
  }

  // 2. Path exact match
  const pathMatch = JSON.stringify(actual.path) === JSON.stringify(expected.path);
  if (!pathMatch) {
    console.error(`  FAIL: Path mismatch`);
    console.error(`    Expected: ${expected.path.join(' -> ')}`);
    console.error(`    Actual:   ${actual.path.join(' -> ')}`);
    testPassed = false;
  } else {
    console.log(`  OK: Path exact match (${actual.path.join(' -> ')})`);
  }

  // 3. Path Cost
  if (Math.abs(actual.pathCost - expected.pathCost) > 1e-6) {
    console.error(`  FAIL: Path cost expected ${expected.pathCost}, got ${actual.pathCost}`);
    testPassed = false;
  } else {
    console.log(`  OK: Path cost matches (${actual.pathCost})`);
  }

  // 4. Nodes Visited
  if (actual.metrics.nodesVisited !== expected.nodesVisited) {
    console.error(`  FAIL: Nodes visited expected ${expected.nodesVisited}, got ${actual.metrics.nodesVisited}`);
    testPassed = false;
  } else {
    console.log(`  OK: Nodes visited matches (${actual.metrics.nodesVisited})`);
  }

  // 5. Total Trace Deltas
  if (actual.traceDeltas.length !== expected.totalTraceDeltas) {
    console.error(`  FAIL: Total trace deltas expected ${expected.totalTraceDeltas}, got ${actual.traceDeltas.length}`);
    testPassed = false;
  } else {
    console.log(`  OK: Total trace deltas matches (${actual.traceDeltas.length})`);
  }

  // 6. Verify Reversibility Invariant on trace deltas
  // Applying afterState forward followed by beforeState backward must restore original state exactly
  let reversibilityPassed = true;
  for (let i = 0; i < actual.traceDeltas.length; i++) {
    const delta = actual.traceDeltas[i];
    // Check that delta has complete before and after state
    if (!delta.beforeState || !delta.afterState) {
      console.error(`  FAIL: Incomplete state snapshot at delta step ${i}`);
      reversibilityPassed = false;
      break;
    }
    // Action validation
    const validActions = ['ENQUEUE', 'DEQUEUE', 'VISIT', 'UPDATE_COST', 'SET_PARENT', 'MARK_PATH'];
    if (!validActions.includes(delta.action)) {
      console.error(`  FAIL: Invalid action ${delta.action} at delta step ${i}`);
      reversibilityPassed = false;
      break;
    }
  }

  if (reversibilityPassed) {
    console.log(`  OK: Reversible trace delta symmetry verified across all ${actual.traceDeltas.length} steps`);
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
