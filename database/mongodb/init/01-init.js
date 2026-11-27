// AETHERIS MongoDB 9.0 Initialization & Seed Script
// Idempotent: safe to run on fresh or already-initialized databases.

const dbName = process.env.MONGO_INITDB_DATABASE || 'aetheris';
const targetDb = db.getSiblingDB(dbName);

const presetsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['id', 'name', 'grid', 'createdAt', 'updatedAt'],
    properties: {
      _id: {},
      id: { bsonType: 'string', minLength: 1, maxLength: 64 },
      name: { bsonType: 'string', minLength: 1, maxLength: 255 },
      description: { bsonType: ['string', 'null'] },
      grid: {
        bsonType: 'object',
        required: ['rows', 'cols', 'startNode', 'targetNode', 'cells'],
        properties: {
          rows: { bsonType: 'int', minimum: 1, maximum: 200 },
          cols: { bsonType: 'int', minimum: 1, maximum: 200 },
          startNode: { bsonType: 'string', pattern: '^r[0-9]+c[0-9]+$' },
          targetNode: { bsonType: 'string', pattern: '^r[0-9]+c[0-9]+$' },
          cells: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['id', 'row', 'col', 'cellType', 'weight'],
              properties: {
                id: { bsonType: 'string', pattern: '^r[0-9]+c[0-9]+$' },
                row: { bsonType: 'int', minimum: 0, maximum: 199 },
                col: { bsonType: 'int', minimum: 0, maximum: 199 },
                cellType: { enum: ['EMPTY', 'WALL', 'START', 'TARGET', 'WEIGHTED'] },
                weight: { bsonType: 'int', minimum: 1, maximum: 100 }
              }
            }
          }
        }
      },
      createdAt: { bsonType: 'string', minLength: 1 },
      updatedAt: { bsonType: 'string', minLength: 1 }
    }
  }
};

const benchmarksValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'id',
      'algorithm',
      'heuristic',
      'gridRows',
      'gridCols',
      'startNode',
      'targetNode',
      'pathFound',
      'pathNodeCount',
      'pathEdgeCount',
      'nodesVisited',
      'maxFrontierSize',
      'totalSteps',
      'executionTimeMs',
      'createdAt'
    ],
    properties: {
      _id: {},
      id: { bsonType: 'string', minLength: 1, maxLength: 64 },
      name: { bsonType: ['string', 'null'] },
      presetId: { bsonType: ['string', 'null'] },
      algorithm: { enum: ['BFS', 'DFS', 'DIJKSTRA', 'ASTAR'] },
      heuristic: { enum: ['MANHATTAN'] },
      gridRows: { bsonType: 'int', minimum: 1, maximum: 200 },
      gridCols: { bsonType: 'int', minimum: 1, maximum: 200 },
      startNode: { bsonType: 'string', pattern: '^r[0-9]+c[0-9]+$' },
      targetNode: { bsonType: 'string', pattern: '^r[0-9]+c[0-9]+$' },
      pathFound: { bsonType: 'bool' },
      pathNodeCount: { bsonType: 'int', minimum: 0 },
      pathEdgeCount: { bsonType: 'int', minimum: 0 },
      algorithmPathCost: { bsonType: ['int', 'null'] },
      terrainPathCost: { bsonType: ['int', 'null'] },
      nodesVisited: { bsonType: 'int', minimum: 0 },
      maxFrontierSize: { bsonType: 'int', minimum: 0 },
      totalSteps: { bsonType: 'int', minimum: 0 },
      executionTimeMs: { bsonType: ['double', 'int'], minimum: 0 },
      createdAt: { bsonType: 'string', minLength: 1 }
    }
  }
};

function ensureCollection(name, validator) {
  const existing = targetDb.getCollectionNames();
  if (!existing.includes(name)) {
    targetDb.createCollection(name, {
      validator,
      validationLevel: 'strict',
      validationAction: 'error'
    });
  } else {
    targetDb.runCommand({
      collMod: name,
      validator,
      validationLevel: 'strict',
      validationAction: 'error'
    });
  }
}

ensureCollection('presets', presetsValidator);
ensureCollection('benchmarks', benchmarksValidator);

targetDb.presets.createIndex({ id: 1 }, { unique: true, name: 'uq_presets_id' });
targetDb.presets.createIndex({ createdAt: 1 }, { name: 'idx_presets_created_at' });

targetDb.benchmarks.createIndex({ id: 1 }, { unique: true, name: 'uq_benchmarks_id' });
targetDb.benchmarks.createIndex({ createdAt: 1 }, { name: 'idx_benchmarks_created_at' });
targetDb.benchmarks.createIndex({ presetId: 1 }, { name: 'idx_benchmarks_preset_id' });
targetDb.benchmarks.createIndex({ algorithm: 1, createdAt: 1 }, { name: 'idx_benchmarks_algorithm_created' });

// Seed canonical presets idempotently
targetDb.presets.updateOne(
  { id: 'preset-canonical-5x5' },
  {
    $setOnInsert: {
      id: 'preset-canonical-5x5',
      name: 'Canonical 5x5 Obstacle Grid',
      description: 'Standard benchmark grid with column 2 wall barrier and r0c2 weighted cell',
      grid: {
        rows: NumberInt(5),
        cols: NumberInt(5),
        startNode: 'r0c0',
        targetNode: 'r4c4',
        cells: [
          { id: 'r0c0', row: NumberInt(0), col: NumberInt(0), cellType: 'START', weight: NumberInt(1) },
          { id: 'r4c4', row: NumberInt(4), col: NumberInt(4), cellType: 'TARGET', weight: NumberInt(1) },
          { id: 'r1c2', row: NumberInt(1), col: NumberInt(2), cellType: 'WALL', weight: NumberInt(1) },
          { id: 'r2c2', row: NumberInt(2), col: NumberInt(2), cellType: 'WALL', weight: NumberInt(1) },
          { id: 'r3c2', row: NumberInt(3), col: NumberInt(2), cellType: 'WALL', weight: NumberInt(1) },
          { id: 'r0c2', row: NumberInt(0), col: NumberInt(2), cellType: 'WEIGHTED', weight: NumberInt(5) }
        ]
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    }
  },
  { upsert: true }
);

targetDb.presets.updateOne(
  { id: 'preset-open-8x8' },
  {
    $setOnInsert: {
      id: 'preset-open-8x8',
      name: 'Open 8x8 Grid',
      description: 'Unobstructed 8x8 grid for heuristic distance and queue expansion visualization',
      grid: {
        rows: NumberInt(8),
        cols: NumberInt(8),
        startNode: 'r0c0',
        targetNode: 'r7c7',
        cells: [
          { id: 'r0c0', row: NumberInt(0), col: NumberInt(0), cellType: 'START', weight: NumberInt(1) },
          { id: 'r7c7', row: NumberInt(7), col: NumberInt(7), cellType: 'TARGET', weight: NumberInt(1) }
        ]
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    }
  },
  { upsert: true }
);
