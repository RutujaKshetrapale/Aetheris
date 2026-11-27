-- AETHERIS MySQL 9.7 Migration V1: Initial Schema
-- Idempotent and repeatable on fresh or already-migrated databases.

USE aetheris;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(32) NOT NULL PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    applied_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Presets table: stores grid preset metadata and dimensions.
CREATE TABLE IF NOT EXISTS presets (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    grid_rows INT NOT NULL,
    grid_cols INT NOT NULL,
    start_node VARCHAR(32) NOT NULL,
    target_node VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT chk_presets_rows CHECK (grid_rows BETWEEN 1 AND 200),
    CONSTRAINT chk_presets_cols CHECK (grid_cols BETWEEN 1 AND 200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Normalized relational representation of non-default grid cells.
CREATE TABLE IF NOT EXISTS preset_cells (
    preset_id VARCHAR(64) NOT NULL,
    cell_id VARCHAR(32) NOT NULL,
    cell_row INT NOT NULL,
    cell_col INT NOT NULL,
    cell_type VARCHAR(16) NOT NULL,
    weight INT NOT NULL DEFAULT 1,
    PRIMARY KEY (preset_id, cell_id),
    CONSTRAINT fk_preset_cells_preset
        FOREIGN KEY (preset_id) REFERENCES presets(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_preset_cells_type
        CHECK (cell_type IN ('EMPTY', 'WALL', 'START', 'TARGET', 'WEIGHTED')),
    CONSTRAINT chk_preset_cells_weight
        CHECK (weight BETWEEN 1 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Benchmarks table: stores summary metrics only (never full trace event arrays).
CREATE TABLE IF NOT EXISTS benchmarks (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NULL,
    preset_id VARCHAR(64) NULL,
    algorithm VARCHAR(16) NOT NULL,
    heuristic VARCHAR(16) NOT NULL,
    grid_rows INT NOT NULL,
    grid_cols INT NOT NULL,
    start_node VARCHAR(32) NOT NULL,
    target_node VARCHAR(32) NOT NULL,
    path_found BOOLEAN NOT NULL,
    path_node_count INT NOT NULL,
    path_edge_count INT NOT NULL,
    algorithm_path_cost INT NULL,
    terrain_path_cost INT NULL,
    nodes_visited INT NOT NULL,
    max_frontier_size INT NOT NULL,
    total_steps INT NOT NULL,
    execution_time_ms DOUBLE NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT chk_benchmarks_algorithm
        CHECK (algorithm IN ('BFS', 'DFS', 'DIJKSTRA', 'ASTAR')),
    CONSTRAINT chk_benchmarks_heuristic
        CHECK (heuristic IN ('MANHATTAN')),
    CONSTRAINT chk_benchmarks_rows CHECK (grid_rows BETWEEN 1 AND 200),
    CONSTRAINT chk_benchmarks_cols CHECK (grid_cols BETWEEN 1 AND 200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes for lookup and chronological queries.
-- MySQL 9.7 does not support CREATE INDEX IF NOT EXISTS directly in all modes,
-- so we use a repeatable conditional procedure or drop/create-safe pattern.
DROP PROCEDURE IF EXISTS aetheris_ensure_index;
DELIMITER $$
CREATE PROCEDURE aetheris_ensure_index(
    IN p_table VARCHAR(64),
    IN p_index VARCHAR(64),
    IN p_ddl VARCHAR(512)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table
          AND index_name = p_index
    ) THEN
        SET @sql_stmt = p_ddl;
        PREPARE stmt FROM @sql_stmt;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL aetheris_ensure_index('presets', 'idx_presets_created_at', 'CREATE INDEX idx_presets_created_at ON presets (created_at)');
CALL aetheris_ensure_index('preset_cells', 'idx_preset_cells_coords', 'CREATE INDEX idx_preset_cells_coords ON preset_cells (preset_id, cell_row, cell_col)');
CALL aetheris_ensure_index('benchmarks', 'idx_benchmarks_created_at', 'CREATE INDEX idx_benchmarks_created_at ON benchmarks (created_at)');
CALL aetheris_ensure_index('benchmarks', 'idx_benchmarks_preset_id', 'CREATE INDEX idx_benchmarks_preset_id ON benchmarks (preset_id)');
CALL aetheris_ensure_index('benchmarks', 'idx_benchmarks_algorithm', 'CREATE INDEX idx_benchmarks_algorithm ON benchmarks (algorithm, created_at)');

DROP PROCEDURE IF EXISTS aetheris_ensure_index;

INSERT IGNORE INTO schema_migrations (version, description)
VALUES ('V1', 'Initial presets, normalized preset_cells, and benchmarks schema');
