# AETHERIS — The Art of Algorithmic Thinking

**Architecture Baseline:** Revision 2.1.0  
**Status:** Phase 1 Foundation, Phase 2 Algorithm Engines & Workbench, and Phase 3 Backend API & Application Layer Implemented

AETHERIS is a cross-platform deterministic pathfinding and algorithmic visualization platform featuring symmetric backend implementations in **Spring Boot 4.2.0 (Java 25)** and **.NET 11 (C# 13)**, paired with **React 19.3.1** (primary workbench) and **Angular 22.3.0** frontends.

## Monorepo Layout

```text
Aetheris/
├── contracts/                  # Canonical OpenAPI 3.2.0 spec & JSON schemas (Draft 2020-12)
│   ├── openapi.yaml            # Canonical OpenAPI 3.2.0 API contract
│   ├── schemas/                # Shared JSON schemas (Draft 2020-12, including preset-bundle.json & benchmark.schema.json)
│   └── fixtures/               # Deterministic pathfinding test fixtures
├── frontends/
│   ├── react/                  # React 19.3.1 + TypeScript 6.0.3 + Vite 8.3.8 workbench (dev port 3100)
│   └── angular/                # Angular 22.3.0 + TypeScript 6.0.3 frontend (dev port 4200)
├── backends/
│   ├── spring-boot/            # Java 25 LTS + Spring Boot 4.2.0 GA REST API (port 8080)
│   └── dotnet/                 # C# 13 + .NET 11.0.100 Minimal API (port 5000)
├── deployments/
│   ├── docker/                 # Production Dockerfiles & Nginx reverse proxy
│   └── configurations/         # 8 deployment configuration profiles (.env & compose)
├── tests/
│   ├── contract-validation/    # OpenAPI 3.2.0 & JSON Schema Draft 2020-12 validator (Ajv 2020)
│   ├── fixture-runner/         # Cross-platform deterministic fixture & reversibility runner
│   └── api-conformance/        # Cross-backend HTTP API & parity conformance test suite
└── docs/                       # Architecture and API documentation
```

## Core Architectural Invariants

- **Canonical API Contract**: Both backends implement `contracts/openapi.yaml` (OpenAPI 3.2.0) and validate against JSON Schema Draft 2020-12 (`contracts/schemas/`).
- **Clean Backend Architecture**: `HTTP/API layer → Application services → Domain & pure algorithm engine → Persistence ports → Persistence adapters`.
- **RFC 9457 Problem Details**: All error responses use `Content-Type: application/problem+json` with `type`, `title`, `status`, `detail`, and `instance`.
- **Three Independent Grid Layers**:
  1. `cellType`: Immutable structural role (`EMPTY`, `WALL`, `START`, `TARGET`, `WEIGHTED` with integer weight 2–100).
  2. `traversalState`: Dynamic exploration state (`UNVISITED`, `FRONTIER`, `ACTIVE`, `CLOSED`).
  3. `inPath`: Orthogonal boolean flag indicating final path membership.
- **Integer Destination Entry Cost Model**:
  $$\text{cost}(u \to v) = \text{weight}(v)$$
  with `START` contributing `0` entry cost.
- **Four Cardinal Directions Only**: Strictly `UP → RIGHT → DOWN → LEFT` (`r{row}c{col}` node IDs).
- **Canonical Trace Action Taxonomy (8 Actions)**:
  `INITIALIZE`, `ENQUEUE_FRONTIER`, `DEQUEUE_FRONTIER`, `EXAMINE_NODE`, `UPDATE_METRICS`, `CLOSE_NODE`, `PATH_FOUND`, `NO_PATH_FOUND`.
  Heap relaxation uses `action: "ENQUEUE_FRONTIER"` with `operationSubtype: "DECREASE_KEY"`.
- **Reversible Trace Deltas & Physical Heap Swap Trails**:
  Every step records `beforeState`, `afterState`, physical `heapSwaps`, and 50-step `keyframes`.

## API Endpoints

### Health & Readiness
- `GET /api/v1/health` — Overall system health (separate `status`, `engineStatus`, `persistenceEngine`, `persistenceStatus`, and honest `databaseConnected`).
- `GET /api/v1/health/live` — Liveness probe (`200 OK`).
- `GET /api/v1/health/ready` — Readiness probe (`200 OK` when the in-memory algorithm engine can serve requests, independent of database connectivity; `503` only if core engine is unready).

### Pathfinding
- `GET /api/v1/pathfinding/algorithms` — List supported algorithms (`BFS`, `DFS`, `DIJKSTRA`, `ASTAR`).
- `POST /api/v1/pathfinding/trace` — Execute deterministic pathfinding and return full reversible trace deltas, keyframes, and metrics.

### Presets
- `GET /api/v1/presets` — List grid presets.
- `GET /api/v1/presets/{id}` — Retrieve preset by ID (`404` if missing).
- `POST /api/v1/presets` — Create a new preset (`201 Created`, `409 Conflict` on duplicate ID).
- `PUT /api/v1/presets/{id}` — Update an existing preset (`200 OK`, `404` if missing).
- `DELETE /api/v1/presets/{id}` — Delete a preset (`204 No Content`, `404` if missing).
- `POST /api/v1/presets/export` — Export presets in canonical `contracts/schemas/preset-bundle.json` format (UTF-8 without BOM, LF line endings, lexicographically sorted keys, 2-space indent, SHA-256 `contentHash` over compact payload).
- `POST /api/v1/presets/import` — Validate and import a portable preset bundle (`400` on malformed schema, `422` on incompatible version, hash mismatch, or invalid grid domain constraints).

### Benchmarks
- `POST /api/v1/benchmarks` — Execute an algorithm run using a monotonic clock and persist summary metrics (`BenchmarkRecord`, without storing individual trace deltas) (`201 Created`).
- `GET /api/v1/benchmarks/{id}` — Retrieve a recorded benchmark by ID (`200 OK`, `404` if missing).

## Persistence & Health Behavior

- **Phase 3 Active Adapter (`IN_MEMORY`)**: Both backends run `InMemoryPresetAdapter` and `InMemoryBenchmarkAdapter` by default. Health reports:
  - `persistenceEngine: "IN_MEMORY"`
  - `persistenceStatus: "UP"`
  - `databaseConnected: false` (never reports `true` without a real external database connection).
- **Phase 4 Database Boundaries (`MYSQL`, `MONGODB`)**: MySQL and MongoDB persistence adapters are deferred to Phase 4. When configured (`AETHERIS_PERSISTENCE_ENGINE=MYSQL` or `Aetheris__Persistence__Engine=MYSQL`), persistence endpoints return **HTTP 503** (`application/problem+json`) without silently falling back to in-memory storage, while core pathfinding (`POST /api/v1/pathfinding/trace`) and `/api/v1/health/ready` remain `200 OK`.

## Error Semantics (RFC 9457)

All error responses return `Content-Type: application/problem+json`:
- `400 Bad Request`: Malformed JSON, unknown enum/algorithm, missing required schema fields, or invalid ID syntax.
- `422 Unprocessable Content`: Validly parsed JSON violating domain invariants (out-of-bounds coordinates, mismatched cell IDs, wall on start/target node, weighted cell weight outside `2..100`, incompatible bundle version, or bundle `contentHash` mismatch).
- `404 Not Found`: Missing preset, benchmark, or endpoint.
- `409 Conflict`: Duplicate preset ID on `POST /api/v1/presets`.
- `503 Service Unavailable`: Configured persistence adapter is unavailable (or core engine unready on `/health/ready`).
- `500 Internal Server Error`: Unexpected failure with sanitized detail (no stack traces, paths, or credentials).

## Request & Response Examples

### Trace Request (`POST /api/v1/pathfinding/trace`)
```json
{
  "algorithm": "DIJKSTRA",
  "grid": {
    "rows": 3,
    "cols": 3,
    "startNode": "r0c0",
    "targetNode": "r2c2",
    "cells": [
      { "id": "r1c1", "row": 1, "col": 1, "cellType": "WALL", "weight": 1 },
      { "id": "r0c1", "row": 0, "col": 1, "cellType": "WEIGHTED", "weight": 5 }
    ]
  }
}
```

### Benchmark Request (`POST /api/v1/benchmarks`)
```json
{
  "name": "Dijkstra 3x3 Check",
  "algorithm": "DIJKSTRA",
  "grid": {
    "rows": 3,
    "cols": 3,
    "startNode": "r0c0",
    "targetNode": "r2c2",
    "cells": []
  }
}
```

## Local Startup Commands

### Spring Boot 4.2.0 (Java 25, port 8080)
```bash
mvn spring-boot:run -f backends/spring-boot/pom.xml
```
Optional env vars: `SERVER_PORT=8080`, `AETHERIS_PERSISTENCE_ENGINE=IN_MEMORY`, `AETHERIS_CORS_ALLOWED_ORIGINS=http://localhost:3100`.

### .NET 11 (C# 13, port 5000)
```bash
dotnet run --project backends/dotnet/Aetheris.Api/Aetheris.Api.csproj --urls http://localhost:5000
```
Optional env vars: `Aetheris__Persistence__Engine=IN_MEMORY`, `AETHERIS_CORS_ALLOWED_ORIGINS=http://localhost:3100`.

### React Workbench (port 3100)
```bash
npm --prefix frontends/react run dev
```
Configure backend target via `frontends/react/.env` (see `frontends/react/.env.example`):
- `VITE_API_BASE_URL=http://localhost:8080` (or `http://localhost:5000`) for direct CORS requests, OR
- `VITE_API_URL=http://localhost:8080` (or `http://localhost:5000`) for Vite `/api` dev proxy.
The React UI uses the configured backend by default without silent fallback; an explicit **Offline Local Engine (Dev)** toggle is available for offline development and clearly labeled in the UI.

### Angular Frontend (port 4200)
```bash
npm --prefix frontends/angular run start
```

## Test Commands

```bash
# 1. OpenAPI 3.2.0 & JSON Schema Draft 2020-12 contract validation
npm run validate:contracts

# 2. Deterministic fixture & bidirectional reversibility tests
npm run test:fixtures

# 3. Spring Boot unit & HTTP integration tests
mvn test -f backends/spring-boot/pom.xml

# 4. .NET 11 unit & HTTP integration tests
dotnet test backends/dotnet/Aetheris.sln

# 5. Live cross-backend HTTP conformance suite (with both backends running on 8080 and 5000)
npm run test:conformance

# 6. Production frontend builds
npm --prefix frontends/react run build
npm --prefix frontends/angular run build
```

## Verified Dependency Matrix

| Component | Version | Role / Environment |
|-----------|---------|--------------------|
| OpenAPI Specification | `3.2.0` | Canonical API Contract (`contracts/openapi.yaml`) |
| JSON Schema | `Draft 2020-12` | Shared Schemas (`contracts/schemas/*.json`) |
| Spring Boot / Java | `4.2.0` / `OpenJDK 25.0.5.1 LTS` | `backends/spring-boot/` REST API (`8080`) |
| .NET / C# | `.NET 11.0.100` / `C# 13` | `backends/dotnet/` Minimal API (`5000`) |
| React / Vite / TS | `19.3.1` / `8.3.8` / `6.0.3` | `frontends/react/` Workbench (`3100`) |
| Angular / TS | `22.3.0` / `6.0.3` | `frontends/angular/` Client (`4200`) |
| Node.js | `26.13.1` | Contract/Conformance/Frontend Build Runtime |
| MySQL / MongoDB | `9.7` / `9.0` (Deferred to Phase 4) | 503 Architectural Boundary Stubs in Phase 3 |
