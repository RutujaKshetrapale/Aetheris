# AETHERIS MySQL 9.7 Schema & Migrations

## Overview

AETHERIS uses a normalized relational schema in MySQL 9.7 (`utf8mb4` / `InnoDB`) for grid presets and benchmark summaries:

1. **`presets`**: Stores preset ID (`VARCHAR(64)` PK), name, optional description, grid dimensions (`grid_rows`, `grid_cols`), `start_node`, `target_node`, and UTC `DATETIME(6)` `created_at` / `updated_at` timestamps.
2. **`preset_cells`**: Normalized child table storing each non-default cell (`preset_id`, `cell_id` composite PK) with `cell_row`, `cell_col`, `cell_type`, and `weight`, linked to `presets(id)` with `ON DELETE CASCADE`.
   - *Design Note*: Normalizing `preset_cells` enforces relational integrity (`CHECK` constraints on `cell_type` and `weight`) and enables SQL-level coordinate queries while reconstructing the exact `GridModel.cells` array deterministically ordered by `(cell_row, cell_col)`.
3. **`benchmarks`**: Stores `BenchmarkRecord` summary metrics only (algorithm, heuristic, grid dimensions, start/target nodes, path counts, algorithm/terrain costs, nodes visited, max frontier size, total steps, monotonic `execution_time_ms`, and UTC `created_at`). Full `TraceDelta` arrays are **never** persisted.
4. **`schema_migrations`**: Tracks applied migration versions.

## Indexes

- `presets`: `PRIMARY KEY (id)`, `idx_presets_created_at (created_at)`
- `preset_cells`: `PRIMARY KEY (preset_id, cell_id)`, `idx_preset_cells_coords (preset_id, cell_row, cell_col)`
- `benchmarks`: `PRIMARY KEY (id)`, `idx_benchmarks_created_at (created_at)`, `idx_benchmarks_preset_id (preset_id)`, `idx_benchmarks_algorithm (algorithm, created_at)`

## Running Migrations & Seeds

### Docker Compose (Automatic)
The Docker Compose MySQL profiles mount `database/mysql/init/`, `database/mysql/migrations/`, and `database/mysql/seed/` into `/docker-entrypoint-initdb.d/` for automatic first-run initialization.

### Manual Execution
```bash
mysql -h 127.0.0.1 -P 3306 -u aetheris -p < database/mysql/init/01-init.sql
mysql -h 127.0.0.1 -P 3306 -u aetheris -p aetheris < database/mysql/migrations/V1__initial_schema.sql
mysql -h 127.0.0.1 -P 3306 -u aetheris -p aetheris < database/mysql/seed/01-seed-presets.sql
```

All scripts are idempotent and safe to re-run on already-migrated databases.
