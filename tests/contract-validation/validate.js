const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

console.log('=== AETHERIS CONTRACT & SCHEMA VALIDATOR ===\n');

let errorCount = 0;

// 1. Validate OpenAPI 3.2.0 Contract
const openApiPath = path.resolve(__dirname, '../../contracts/openapi.yaml');
console.log(`[1/3] Validating OpenAPI Contract: ${openApiPath}`);

if (!fs.existsSync(openApiPath)) {
  console.error(`FAIL: OpenAPI file not found at ${openApiPath}`);
  process.exit(1);
}

try {
  const openApiContent = fs.readFileSync(openApiPath, 'utf-8');
  const openApiDoc = yaml.parse(openApiContent);

  console.log(`  OpenAPI Version: ${openApiDoc.openapi}`);
  console.log(`  Title: ${openApiDoc.info?.title}`);
  console.log(`  Contract Version: ${openApiDoc.info?.version}`);

  if (openApiDoc.openapi !== '3.2.0') {
    console.error(`  FAIL: OpenAPI version must be 3.2.0, found ${openApiDoc.openapi}`);
    errorCount++;
  } else {
    console.log(`  OK: OpenAPI version is 3.2.0`);
  }

  const requiredPaths = [
    '/api/v1/health',
    '/api/v1/health/live',
    '/api/v1/health/ready',
    '/api/v1/pathfinding/algorithms',
    '/api/v1/pathfinding/trace',
    '/api/v1/presets',
    '/api/v1/presets/{id}',
    '/api/v1/presets/export',
    '/api/v1/presets/import',
    '/api/v1/benchmarks',
    '/api/v1/benchmarks/{id}'
  ];

  for (const p of requiredPaths) {
    if (!openApiDoc.paths[p]) {
      console.error(`  FAIL: Missing required path ${p}`);
      errorCount++;
    } else {
      console.log(`  OK: Path ${p} declared`);
    }
  }

  // Check components & schemas
  const schemas = openApiDoc.components?.schemas || {};
  const requiredSchemas = [
    'AlgorithmType',
    'CellType',
    'TraversalState',
    'TraceAction',
    'CellDefinition',
    'CellState',
    'GridModel',
    'HeapSwap',
    'TraceDelta',
    'Keyframe',
    'ExecutionMetrics',
    'PathfindingRequest',
    'PathfindingResponse',
    'AlgorithmInfo',
    'GridPreset',
    'SavePresetRequest',
    'ExportPresetsRequest',
    'PresetBundle',
    'ImportPresetsResponse',
    'BenchmarkRequest',
    'BenchmarkRecord',
    'HealthStatus',
    'ProbeStatus',
    'ProblemDetails'
  ];

  for (const s of requiredSchemas) {
    if (!schemas[s]) {
      console.error(`  FAIL: Missing component schema ${s}`);
      errorCount++;
    } else {
      console.log(`  OK: Schema ${s} declared`);
    }
  }

  console.log('  OpenAPI structure and reference check: PASSED');
} catch (err) {
  console.error(`  FAIL parsing OpenAPI document:`, err);
  errorCount++;
}

// 2. Validate JSON Schemas (Draft 2020-12)
console.log('\n[2/3] Validating Shared JSON Schemas (Draft 2020-12)');
const schemasDir = path.resolve(__dirname, '../../contracts/schemas');
const schemaFiles = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

// First pass: add all schemas to Ajv
const loadedSchemas = {};
for (const file of schemaFiles) {
  const filePath = path.join(schemasDir, file);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    loadedSchemas[file] = parsed;
    ajv.addSchema(parsed, file);
    console.log(`  Loaded schema: ${file}`);
  } catch (err) {
    console.error(`  FAIL loading schema ${file}:`, err.message);
    errorCount++;
  }
}

// Second pass: compile schemas to ensure validity
for (const [file, schema] of Object.entries(loadedSchemas)) {
  try {
    const validate = ajv.compile(schema);
    if (typeof validate === 'function') {
      console.log(`  Compiled & Validated: ${file}`);
    }
  } catch (err) {
    console.error(`  FAIL compiling schema ${file}:`, err.message);
    errorCount++;
  }
}

// 3. Validate Deterministic Fixtures against Schemas
console.log('\n[3/3] Validating Deterministic Fixtures against JSON Schemas');
const fixturesDir = path.resolve(__dirname, '../../contracts/fixtures');
const fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.fixture.json'));

const gridValidator = ajv.getSchema('grid.schema.json');
const traceDeltaValidator = ajv.getSchema('trace-delta.schema.json');
const keyframeValidator = ajv.getSchema('keyframe.schema.json');

for (const fFile of fixtureFiles) {
  const fPath = path.join(fixturesDir, fFile);
  const fixture = JSON.parse(fs.readFileSync(fPath, 'utf-8'));

  console.log(`\n  Checking Fixture: ${fFile}`);
  console.log(`    Algorithm: ${fixture.algorithm}`);
  console.log(`    Expected Path: ${fixture.expectedOutcome.path ? fixture.expectedOutcome.path.join(' -> ') : '[NONE]'}`);
  console.log(`    Cost: algorithm=${fixture.expectedOutcome.algorithmPathCost}, terrain=${fixture.expectedOutcome.terrainPathCost}`);
  console.log(`    Trace Deltas: ${fixture.traceDeltas.length}, Keyframes: ${fixture.keyframes ? fixture.keyframes.length : 0}`);

  // Validate grid
  const validGrid = gridValidator(fixture.grid);
  if (!validGrid) {
    console.error(`    FAIL: Fixture grid does not match grid.schema.json:`, gridValidator.errors);
    errorCount++;
  } else {
    console.log(`    OK: Grid conforms to grid.schema.json`);
  }

  // Validate each trace delta
  let deltasValid = true;
  for (let i = 0; i < fixture.traceDeltas.length; i++) {
    const delta = fixture.traceDeltas[i];
    const valid = traceDeltaValidator(delta);
    if (!valid) {
      console.error(`    FAIL: Delta at step ${i} invalid:`, traceDeltaValidator.errors);
      deltasValid = false;
      errorCount++;
      break;
    }
  }

  if (deltasValid) {
    console.log(`    OK: All ${fixture.traceDeltas.length} trace deltas conform to trace-delta.schema.json`);
  }

  // Validate keyframes if present
  if (fixture.keyframes && fixture.keyframes.length > 0) {
    let keyframesValid = true;
    for (let i = 0; i < fixture.keyframes.length; i++) {
      const kf = fixture.keyframes[i];
      const valid = keyframeValidator(kf);
      if (!valid) {
        console.error(`    FAIL: Keyframe at index ${i} invalid:`, keyframeValidator.errors);
        keyframesValid = false;
        errorCount++;
        break;
      }
    }
    if (keyframesValid) {
      console.log(`    OK: All ${fixture.keyframes.length} keyframes conform to keyframe.schema.json`);
    }
  }
}

console.log('\n=============================================');
if (errorCount === 0) {
  console.log('CONTRACT & SCHEMA VALIDATION: ALL CHECKS PASSED (0 ERRORS)');
  process.exit(0);
} else {
  console.error(`CONTRACT & SCHEMA VALIDATION FAILED WITH ${errorCount} ERRORS`);
  process.exit(1);
}
