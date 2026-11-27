# AETHERIS MongoDB 9.0 Collections & Validators

## Overview

AETHERIS uses two collections in MongoDB 9.0 (`aetheris` database):

1. **`presets`**: Stores grid presets (`id`, `name`, `description`, `grid`, UTC ISO-8601 `createdAt`, `updatedAt`) with strict `$jsonSchema` validation (`database/mongodb/validators/presets.validator.json`).
2. **`benchmarks`**: Stores `BenchmarkRecord` summary metrics only (never full `TraceDelta` arrays) with strict `$jsonSchema` validation (`database/mongodb/validators/benchmarks.validator.json`).

## Indexes

- `presets`:
  - `uq_presets_id`: `{ id: 1 }` (unique)
  - `idx_presets_created_at`: `{ createdAt: 1 }`
- `benchmarks`:
  - `uq_benchmarks_id`: `{ id: 1 }` (unique)
  - `idx_benchmarks_created_at`: `{ createdAt: 1 }`
  - `idx_benchmarks_preset_id`: `{ presetId: 1 }`
  - `idx_benchmarks_algorithm_created`: `{ algorithm: 1, createdAt: 1 }`

## Initialization & Seeding

### Docker Compose (Automatic)
The Docker Compose MongoDB profiles mount `database/mongodb/init/` into `/docker-entrypoint-initdb.d/` for automatic first-run collection creation, validator setup, index creation, and seeding.

### Manual Execution
```bash
mongosh "mongodb://aetheris:aetheris_password@127.0.0.1:27017/aetheris?authSource=admin" database/mongodb/init/01-init.js
```

The script is idempotent and safe to re-run.
