const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const SPRING_URL = process.env.SPRING_BOOT_URL || 'http://localhost:8080';
const DOTNET_URL = process.env.DOTNET_URL || 'http://localhost:5000';
const SPRING_OUTAGE_URL = process.env.SPRING_OUTAGE_URL || '';
const DOTNET_OUTAGE_URL = process.env.DOTNET_OUTAGE_URL || '';

// Load Draft 2020-12 JSON schemas
const schemasDir = path.resolve(__dirname, '../../contracts/schemas');
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

for (const file of fs.readdirSync(schemasDir).filter((f) => f.endsWith('.json'))) {
  const parsed = JSON.parse(fs.readFileSync(path.join(schemasDir, file), 'utf-8'));
  ajv.addSchema(parsed, file);
}

const validateTraceResponse = ajv.getSchema('pathfinding-response.schema.json');
const validatePreset = ajv.getSchema('preset.schema.json');
const validatePresetBundle = ajv.getSchema('preset-bundle.json');
const validateBenchmark = ajv.getSchema('benchmark.schema.json');
const validateProblem = ajv.getSchema('problem-details.schema.json');

function assertSchema(validator, data, label) {
  const ok = validator(data);
  if (!ok) {
    throw new Error(`Schema validation failed for ${label}: ${JSON.stringify(validator.errors)}`);
  }
}

function assertLexSortedKeys(obj, pathPrefix = '$') {
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => assertLexSortedKeys(item, `${pathPrefix}[${idx}]`));
  } else if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    const sorted = [...keys].sort();
    assert.deepStrictEqual(keys, sorted, `Object keys not lexicographically sorted at ${pathPrefix}: ${keys.join(',')}`);
    for (const k of keys) {
      assertLexSortedKeys(obj[k], `${pathPrefix}.${k}`);
    }
  }
}

async function httpRequest(baseUrl, route, options = {}) {
  const res = await fetch(`${baseUrl}${route}`, options);
  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());
  const text = buffer.toString('utf-8');
  let json = null;
  if (text && (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('['))) {
    try {
      json = JSON.parse(text);
    } catch {
      // ignore non-json
    }
  }
  return { status: res.status, headers: res.headers, contentType, buffer, text, json };
}

async function runBackendSuite(name, baseUrl) {
  console.log(`\n=== Running API Conformance Suite: ${name} (${baseUrl}) ===`);

  // 1. Health & Readiness
  const live = await httpRequest(baseUrl, '/api/v1/health/live');
  assert.strictEqual(live.status, 200, `${name} /health/live`);
  assert.strictEqual(live.json.status, 'UP');

  const ready = await httpRequest(baseUrl, '/api/v1/health/ready');
  assert.strictEqual(ready.status, 200, `${name} /health/ready`);
  assert.strictEqual(ready.json.status, 'UP');

  const health = await httpRequest(baseUrl, '/api/v1/health');
  assert.strictEqual(health.status, 200, `${name} /health`);
  assert.strictEqual(health.json.status, 'UP');
  assert.strictEqual(health.json.engineStatus, 'UP');
  assert.strictEqual(health.json.persistenceEngine, 'IN_MEMORY');
  assert.strictEqual(health.json.persistenceStatus, 'UP');
  assert.strictEqual(health.json.databaseConnected, false, `${name} must report databaseConnected=false for IN_MEMORY`);
  console.log(`  [PASS] Health & Readiness`);

  // 2. Algorithms list
  const algos = await httpRequest(baseUrl, '/api/v1/pathfinding/algorithms');
  assert.strictEqual(algos.status, 200);
  assert.strictEqual(algos.json.length, 4);
  console.log(`  [PASS] Algorithms metadata`);

  // 3. Pathfinding: All 4 algorithms on canonical 5x5 weighted/walled grid
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

  const traceResults = {};
  for (const algorithm of ['BFS', 'DFS', 'DIJKSTRA', 'ASTAR']) {
    const res = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm, grid: canonicalGrid })
    });
    assert.strictEqual(res.status, 200, `${name} ${algorithm} trace status`);
    assertSchema(validateTraceResponse, res.json, `${name} ${algorithm} trace`);
    assert.strictEqual(res.json.pathFound, true);
    traceResults[algorithm] = res.json;
  }

  // Start equals target -> 200
  const sameRes = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      algorithm: 'ASTAR',
      grid: { rows: 3, cols: 3, startNode: 'r1c1', targetNode: 'r1c1', cells: [] }
    })
  });
  assert.strictEqual(sameRes.status, 200);
  assertSchema(validateTraceResponse, sameRes.json, `${name} start==target`);
  assert.deepStrictEqual(sameRes.json.path, ['r1c1']);
  assert.strictEqual(sameRes.json.pathNodeCount, 1);
  assert.strictEqual(sameRes.json.pathEdgeCount, 0);

  // Unreachable target -> 200 empty path
  const unreachableRes = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      algorithm: 'BFS',
      grid: {
        rows: 3,
        cols: 3,
        startNode: 'r0c0',
        targetNode: 'r2c2',
        cells: [
          { id: 'r0c1', row: 0, col: 1, cellType: 'WALL', weight: 1 },
          { id: 'r1c0', row: 1, col: 0, cellType: 'WALL', weight: 1 }
        ]
      }
    })
  });
  assert.strictEqual(unreachableRes.status, 200);
  assertSchema(validateTraceResponse, unreachableRes.json, `${name} unreachable`);
  assert.strictEqual(unreachableRes.json.pathFound, false);
  assert.deepStrictEqual(unreachableRes.json.path, []);
  assert.strictEqual(unreachableRes.json.noPathReason, 'FRONTIER_EXHAUSTED');
  console.log(`  [PASS] Pathfinding algorithms, start==target, unreachable`);

  // 4. Pathfinding error semantics (400 vs 422 RFC 9457)
  const malformedRes = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-valid-json'
  });
  assert.strictEqual(malformedRes.status, 400);
  assert(malformedRes.contentType.includes('application/problem+json'));
  assertSchema(validateProblem, malformedRes.json, `${name} malformed JSON`);

  const invalidAlgoRes = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ algorithm: 'BELLMAN_FORD', grid: canonicalGrid })
  });
  assert.strictEqual(invalidAlgoRes.status, 400);
  assert(invalidAlgoRes.contentType.includes('application/problem+json'));
  assertSchema(validateProblem, invalidAlgoRes.json, `${name} invalid algo`);

  const outOfBoundsRes = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      algorithm: 'BFS',
      grid: { rows: 3, cols: 3, startNode: 'r0c0', targetNode: 'r5c5', cells: [] }
    })
  });
  assert.strictEqual(outOfBoundsRes.status, 422);
  assert(outOfBoundsRes.contentType.includes('application/problem+json'));
  assertSchema(validateProblem, outOfBoundsRes.json, `${name} out of bounds`);

  const wallStartRes = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      algorithm: 'BFS',
      grid: {
        rows: 3,
        cols: 3,
        startNode: 'r0c0',
        targetNode: 'r2c2',
        cells: [{ id: 'r0c0', row: 0, col: 0, cellType: 'WALL', weight: 1 }]
      }
    })
  });
  assert.strictEqual(wallStartRes.status, 422);
  assert(wallStartRes.contentType.includes('application/problem+json'));
  assertSchema(validateProblem, wallStartRes.json, `${name} wall on start`);
  console.log(`  [PASS] Pathfinding RFC 9457 400/422 error semantics`);

  // 5. Preset CRUD & Export/Import
  const presetId = `conformance-${Date.now()}`;
  const presetPayload = {
    id: presetId,
    name: 'Conformance Grid',
    description: 'Cross-backend conformance test preset',
    grid: {
      rows: 4,
      cols: 4,
      startNode: 'r0c0',
      targetNode: 'r3c3',
      cells: [
        { id: 'r1c1', row: 1, col: 1, cellType: 'WALL', weight: 1 },
        { id: 'r2c2', row: 2, col: 2, cellType: 'WEIGHTED', weight: 10 }
      ]
    }
  };

  const createdPreset = await httpRequest(baseUrl, '/api/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(presetPayload)
  });
  assert.strictEqual(createdPreset.status, 201);
  assertSchema(validatePreset, createdPreset.json, `${name} created preset`);

  const dupPreset = await httpRequest(baseUrl, '/api/v1/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(presetPayload)
  });
  assert.strictEqual(dupPreset.status, 409);
  assert(dupPreset.contentType.includes('application/problem+json'));

  const listPresets = await httpRequest(baseUrl, '/api/v1/presets');
  assert.strictEqual(listPresets.status, 200);
  assert(listPresets.json.some((p) => p.id === presetId));

  const updatedPreset = await httpRequest(baseUrl, `/api/v1/presets/${presetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...presetPayload, name: 'Conformance Grid Updated' })
  });
  assert.strictEqual(updatedPreset.status, 200);
  assert.strictEqual(updatedPreset.json.name, 'Conformance Grid Updated');

  const exportRes = await httpRequest(baseUrl, '/api/v1/presets/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presetIds: [presetId] })
  });
  assert.strictEqual(exportRes.status, 200);
  assert(!(exportRes.buffer[0] === 0xef && exportRes.buffer[1] === 0xbb && exportRes.buffer[2] === 0xbf), 'Export must not have UTF-8 BOM');
  assert(!exportRes.text.includes('\r\n'), 'Export must use LF line endings only');
  assert(exportRes.text.includes('\n  "format": "aetheris-preset-bundle"'), 'Export must use 2-space indentation');
  assertSchema(validatePresetBundle, exportRes.json, `${name} preset bundle`);
  assertLexSortedKeys(exportRes.json);

  const deleteRes = await httpRequest(baseUrl, `/api/v1/presets/${presetId}`, { method: 'DELETE' });
  assert.strictEqual(deleteRes.status, 204);

  const missingPreset = await httpRequest(baseUrl, `/api/v1/presets/${presetId}`);
  assert.strictEqual(missingPreset.status, 404);
  assert(missingPreset.contentType.includes('application/problem+json'));

  const importRes = await httpRequest(baseUrl, '/api/v1/presets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: exportRes.text
  });
  assert.strictEqual(importRes.status, 200);
  assert.strictEqual(importRes.json.importedCount, 1);

  const badImport = await httpRequest(baseUrl, '/api/v1/presets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: exportRes.text.replace('Conformance Grid Updated', 'Tampered Grid')
  });
  assert.strictEqual(badImport.status, 422);
  assert(badImport.contentType.includes('application/problem+json'));

  // 6. Benchmarks
  const benchCreate = await httpRequest(baseUrl, '/api/v1/benchmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Conformance Bench', presetId, algorithm: 'DIJKSTRA' })
  });
  assert.strictEqual(benchCreate.status, 201);
  assertSchema(validateBenchmark, benchCreate.json, `${name} benchmark create`);
  assert.strictEqual(benchCreate.json.traceDeltas, undefined, 'Trace deltas must not be stored on benchmark record');

  const benchGet = await httpRequest(baseUrl, `/api/v1/benchmarks/${benchCreate.json.id}`);
  assert.strictEqual(benchGet.status, 200);
  assert.strictEqual(benchGet.json.id, benchCreate.json.id);

  const benchMissing = await httpRequest(baseUrl, '/api/v1/benchmarks/bench-missing-999');
  assert.strictEqual(benchMissing.status, 404);
  assert(benchMissing.contentType.includes('application/problem+json'));

  // Clean up test preset
  await httpRequest(baseUrl, `/api/v1/presets/${presetId}`, { method: 'DELETE' });
  console.log(`  [PASS] Presets CRUD, Canonical Export/Import & Benchmarks`);

  // 7. CORS for React dev server port 3100
  const corsRes = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3100',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert(corsRes.status === 200 || corsRes.status === 204);
  assert(corsRes.headers.get('access-control-allow-origin'), `${name} must return Access-Control-Allow-Origin for :3100`);
  console.log(`  [PASS] CORS preflight for http://localhost:3100`);

  return { traceResults, exportedBundle: exportRes.text };
}

async function runOutageSuite(name, baseUrl) {
  console.log(`\n=== Running Persistence Outage Suite: ${name} (${baseUrl}) ===`);
  const health = await httpRequest(baseUrl, '/api/v1/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.json.engineStatus, 'UP');
  assert.strictEqual(health.json.persistenceStatus, 'UNAVAILABLE');
  assert.strictEqual(health.json.databaseConnected, false);

  const ready = await httpRequest(baseUrl, '/api/v1/health/ready');
  assert.strictEqual(ready.status, 200);

  const trace = await httpRequest(baseUrl, '/api/v1/pathfinding/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      algorithm: 'BFS',
      grid: { rows: 3, cols: 3, startNode: 'r0c0', targetNode: 'r2c2', cells: [] }
    })
  });
  assert.strictEqual(trace.status, 200);
  assert.strictEqual(trace.json.pathFound, true);

  const presets = await httpRequest(baseUrl, '/api/v1/presets');
  assert.strictEqual(presets.status, 503);
  assert(presets.contentType.includes('application/problem+json'));
  assertSchema(validateProblem, presets.json, `${name} 503 presets`);

  const bench = await httpRequest(baseUrl, '/api/v1/benchmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      algorithm: 'BFS',
      grid: { rows: 3, cols: 3, startNode: 'r0c0', targetNode: 'r2c2', cells: [] }
    })
  });
  assert.strictEqual(bench.status, 503);
  assert(bench.contentType.includes('application/problem+json'));
  assertSchema(validateProblem, bench.json, `${name} 503 benchmark`);
  console.log(`  [PASS] Persistence outage returns 503 while pathfinding stays 200`);
}

function stripTimings(traceResp) {
  const clone = JSON.parse(JSON.stringify(traceResp));
  if (clone.metrics) {
    delete clone.metrics.executionTimeMs;
  }
  return clone;
}

async function main() {
  const springRes = await runBackendSuite('Spring Boot 4.2.0', SPRING_URL);
  const dotnetRes = await runBackendSuite('.NET 11', DOTNET_URL);

  console.log('\n=== Cross-Backend Parity & Bundle Portability ===');
  for (const algo of ['BFS', 'DFS', 'DIJKSTRA', 'ASTAR']) {
    assert.deepStrictEqual(
      stripTimings(springRes.traceResults[algo]),
      stripTimings(dotnetRes.traceResults[algo]),
      `Cross-backend trace parity mismatch for ${algo}`
    );
    console.log(`  [PASS] Exact trace parity for ${algo}`);
  }

  // Cross-import Spring Boot bundle -> .NET and .NET bundle -> Spring Boot
  const importIntoDotnet = await httpRequest(DOTNET_URL, '/api/v1/presets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: springRes.exportedBundle
  });
  assert.strictEqual(importIntoDotnet.status, 200);
  const importedIdFromSpring = importIntoDotnet.json.presets[0].id;
  await httpRequest(DOTNET_URL, `/api/v1/presets/${importedIdFromSpring}`, { method: 'DELETE' });

  const importIntoSpring = await httpRequest(SPRING_URL, '/api/v1/presets/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: dotnetRes.exportedBundle
  });
  assert.strictEqual(importIntoSpring.status, 200);
  const importedIdFromDotnet = importIntoSpring.json.presets[0].id;
  await httpRequest(SPRING_URL, `/api/v1/presets/${importedIdFromDotnet}`, { method: 'DELETE' });
  console.log('  [PASS] Cross-backend preset bundle export/import portability');

  if (SPRING_OUTAGE_URL) {
    await runOutageSuite('Spring Boot (MYSQL Stub)', SPRING_OUTAGE_URL);
  }
  if (DOTNET_OUTAGE_URL) {
    await runOutageSuite('.NET 11 (MYSQL Stub)', DOTNET_OUTAGE_URL);
  }

  console.log('\n=====================================================');
  console.log('CROSS-BACKEND API CONFORMANCE: ALL CHECKS PASSED');
}

main().catch((err) => {
  console.error('\nCONFORMANCE TEST FAILED:', err);
  process.exit(1);
});
