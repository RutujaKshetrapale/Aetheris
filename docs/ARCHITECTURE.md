# AETHERIS Architecture Specification

**Revision:** 2.1.0  
**Status:** Phase 1–4 Implemented (Core Engines, Workbenches, Backend APIs, and Real MySQL 9.7 & MongoDB 9.0 Persistence)  
**Domain:** Cross-Platform Deterministic Pathfinding Engine & Algorithmic Visualizer

## 1. Monorepo Architecture Overview

AETHERIS demonstrates algorithmic symmetry across polyglot stacks. Both **Spring Boot 4.2.0 (Java 25)** and **.NET 11 (C# 13)** implement the exact same OpenAPI 3.2.0 contract (`contracts/openapi.yaml`) and JSON Schema Draft 2020-12 definitions (`contracts/schemas/`).

Each backend enforces strict layered boundaries:
```text
HTTP/API Layer (Controllers / Minimal API Endpoints + RFC 9457 Exception Handling)
       │
       ▼
Application Layer (PathfindingApplicationService, PresetApplicationService, BenchmarkApplicationService, HealthApplicationService, PresetBundleCodec)
       │
       ▼
Domain & Pure Algorithm Engine (PathfindingEngine, Reversible Frontiers, GridValidator, Domain Models)
       │
       ▼
Persistence Ports (PresetRepositoryPort / IPresetRepository, BenchmarkRepositoryPort / IBenchmarkRepository)
       │
       ▼
Persistence Adapters (InMemory, MySQL 9.7 [JPA / Dapper], MongoDB 9.0 [Spring Data MongoDB / MongoDB.Driver])
```

## 2. Invariants & Determinism Rules

### 2.1 Coordinate System & Deterministic Node Identifiers
- Coordinates are 0-indexed: `(row, col)` with `1 <= rows, cols <= 200`.
- Node identifier format is strictly canonical: `r{row}c{col}` (e.g. `r0c0`, `r3c4`).

### 2.2 Three Independent Grid Layers
1. **`cellType`**: `EMPTY` (cost 1), `WALL` (impassable), `START` (cost 0), `TARGET`, `WEIGHTED` (integer cost 2–100).
2. **`traversalState`**: `UNVISITED`, `FRONTIER`, `ACTIVE`, `CLOSED`.
3. **`inPath`**: Orthogonal boolean flag for final reconstructed path membership.

### 2.3 Strict Neighbor Exploration & Tie-Breaking
- **4 Cardinal Directions Only**: `UP (-1,0)`, `RIGHT (0,+1)`, `DOWN (+1,0)`, `LEFT (0,-1)`.
- **BFS**: FIFO Queue.
- **DFS**: LIFO Stack with reverse push order (`LEFT, DOWN, RIGHT, UP`) so pop examination order is `UP, RIGHT, DOWN, LEFT`.
- **Dijkstra**: Indexed Min-Heap ordered by `(gCost, 0, enqueueSequence)`.
- **A***: Indexed Min-Heap ordered by `(fCost, hCost, enqueueSequence)` using integer Manhattan heuristic multiplied by minimum traversable terrain weight. Decrease-key preserves original `enqueueSequence`.

### 2.4 Reversible Trace Taxonomy (8 Canonical Actions)
Every step emits a `TraceDelta` using one of the 8 canonical `TraceAction` values:
- `INITIALIZE`
- `ENQUEUE_FRONTIER` (heap relaxations set `operationSubtype: "DECREASE_KEY"`)
- `DEQUEUE_FRONTIER`
- `EXAMINE_NODE`
- `UPDATE_METRICS`
- `CLOSE_NODE`
- `PATH_FOUND`
- `NO_PATH_FOUND`

Keyframes are captured every 50 steps (`step % 50 == 0`).

### 2.5 Special Cases
- **Start Equals Target**: `path = [startNode]`, `pathNodeCount = 1`, `pathEdgeCount = 0`, `algorithmPathCost = 0`, `terrainPathCost = 0`, `nodesVisited = 1`, 2 events (`INITIALIZE`, `PATH_FOUND`).
- **Unreachable Target**: `path = []`, `pathNodeCount = 0`, `pathEdgeCount = 0`, `algorithmPathCost = null`, `terrainPathCost = null`, final event `NO_PATH_FOUND` with `noPathReason = "FRONTIER_EXHAUSTED"`.

## 3. Portable Preset Bundle Specification (`contracts/schemas/preset-bundle.json`)
- UTF-8 encoding without BOM.
- LF (`\n`) line endings only.
- Lexicographically sorted object keys at all nesting depths.
- Exact integer values and preserved array ordering.
- Compact representation used for SHA-256 `contentHash` verification; 2-space indented representation for normal exports.

## 4. Persistence Decoupling & Database Adapters
- Core pathfinding (`POST /api/v1/pathfinding/trace`) and readiness (`GET /api/v1/health/ready`) do not depend on database connectivity.
- `IN_MEMORY` mode uses `InMemoryPresetAdapter` and `InMemoryBenchmarkAdapter`; `GET /api/v1/health` reports `persistenceEngine: "IN_MEMORY"`, `persistenceStatus: "UP"`, and `databaseConnected: false`.
- `MYSQL` mode uses normalized `presets` + `preset_cells` and `benchmarks` tables (Spring Data JPA / Hibernate in Spring Boot; Dapper + `MySqlConnector` in .NET 11).
- `MONGODB` mode uses `presets` and `benchmarks` collections with strict `$jsonSchema` validation (Spring Data MongoDB in Spring Boot; `MongoDB.Driver` in .NET 11).
- When a configured database is unavailable or misconfigured, health checks remain bounded (2s timeout), `GET /api/v1/health` reports `persistenceStatus: "UNAVAILABLE"` and `databaseConnected: false`, and persistence endpoints return RFC 9457 `503 Service Unavailable` without silent fallback to `IN_MEMORY`.
