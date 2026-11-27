-- AETHERIS MySQL 9.7 Development Seed Data
-- Idempotent seed for canonical default presets.

USE aetheris;

INSERT IGNORE INTO presets (id, name, description, grid_rows, grid_cols, start_node, target_node, created_at, updated_at)
VALUES
  (
    'preset-canonical-5x5',
    'Canonical 5x5 Obstacle Grid',
    'Standard benchmark grid with column 2 wall barrier and r0c2 weighted cell',
    5,
    5,
    'r0c0',
    'r4c4',
    '2026-01-01 00:00:00.000000',
    '2026-01-01 00:00:00.000000'
  ),
  (
    'preset-open-8x8',
    'Open 8x8 Grid',
    'Unobstructed 8x8 grid for heuristic distance and queue expansion visualization',
    8,
    8,
    'r0c0',
    'r7c7',
    '2026-01-01 00:00:00.000000',
    '2026-01-01 00:00:00.000000'
  );

INSERT IGNORE INTO preset_cells (preset_id, cell_id, cell_row, cell_col, cell_type, weight)
VALUES
  ('preset-canonical-5x5', 'r0c0', 0, 0, 'START', 1),
  ('preset-canonical-5x5', 'r4c4', 4, 4, 'TARGET', 1),
  ('preset-canonical-5x5', 'r1c2', 1, 2, 'WALL', 1),
  ('preset-canonical-5x5', 'r2c2', 2, 2, 'WALL', 1),
  ('preset-canonical-5x5', 'r3c2', 3, 2, 'WALL', 1),
  ('preset-canonical-5x5', 'r0c2', 0, 2, 'WEIGHTED', 5),
  ('preset-open-8x8', 'r0c0', 0, 0, 'START', 1),
  ('preset-open-8x8', 'r7c7', 7, 7, 'TARGET', 1);
