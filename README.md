# AETHERIS — The Art of Algorithmic Thinking

**Architecture Baseline:** Revision 2.1.0  
**Status:** Phase 1 Foundation Fully Established & Verified

AETHERIS is an algorithm visualization and exploration platform engineering showcase designed to demonstrate cross-platform deterministic pathfinding across multiple frontends (React, Angular), backends (Spring Boot, .NET 9), and persistence layers (MySQL, MongoDB).

## Monorepo Layout

```
Aetheris/
├── contracts/                  # Canonical OpenAPI 3.2.0 spec & JSON schemas (Draft 2020-12)
│   ├── openapi.yaml            # Canonical OpenAPI 3.2.0 API contract
│   ├── schemas/                # Shared JSON schemas (Draft 2020-12)
│   └── fixtures/               # Deterministic pathfinding test fixtures (BFS, DFS, Dijkstra, A*, start==target, unreachable)
├── frontends/
│   ├── react/                  # React 19 + TypeScript 5.7 + Vite 6 frontend
│   └── angular/                # Angular 19 + TypeScript frontend
├── backends/
│   ├── spring-boot/            # Java 21 LTS + Spring Boot 3.2.5 backend
│   └── dotnet/                 # C# 13 + .NET 9.0 Web API backend
├── deployments/
│   ├── docker/                 # Production Dockerfiles & Nginx reverse proxy
│   └── configurations/         # 8 mandatory deployment configuration profiles (.env & compose)
├── tests/
│   ├── contract-validation/    # OpenAPI 3.2.0 & JSON Schema contract validator (Ajv 2020)
│   └── fixture-runner/         # Cross-platform deterministic fixture generator & reversibility runner
└── docs/                       # Architecture documentation and specifications
```

## Mandatory 8 Configuration Profiles

All 8 configurations consume the canonical `contracts/openapi.yaml` and support pure in-memory deterministic pathfinding independent of database connectivity:

1. **React + Spring Boot + MySQL** (`deployments/configurations/docker-compose.react-springboot-mysql.yml`)
2. **React + Spring Boot + MongoDB** (`deployments/configurations/docker-compose.react-springboot-mongodb.yml`)
3. **React + .NET + MySQL** (`deployments/configurations/docker-compose.react-dotnet-mysql.yml`)
4. **React + .NET + MongoDB** (`deployments/configurations/docker-compose.react-dotnet-mongodb.yml`)
5. **Angular + Spring Boot + MySQL** (`deployments/configurations/docker-compose.angular-springboot-mysql.yml`)
6. **Angular + Spring Boot + MongoDB** (`deployments/configurations/docker-compose.angular-springboot-mongodb.yml`)
7. **Angular + .NET + MySQL** (`deployments/configurations/docker-compose.angular-dotnet-mysql.yml`)
8. **Angular + .NET + MongoDB** (`deployments/configurations/docker-compose.angular-dotnet-mongodb.yml`)

## Core Architectural Invariants

- **Canonical API Contract**: All 8 configurations implement and consume the single OpenAPI 3.2.0 contract (`contracts/openapi.yaml`) targeting JSON Schema Draft 2020-12.
- **Canonical Endpoint**: `POST /api/v1/pathfinding/trace` (with `/find` preserved as a backward-compatible alias).
- **RFC 9457 Problem Details**: All error responses return `application/problem+json`.
- **Three Independent Grid Layers**:
  1. `cellType`: Immutable structural role: `EMPTY` (weight 1), `WALL` (impassable), `START` (weight 0), `TARGET` (destination), `WEIGHTED` (integer weight 2–100).
  2. `traversalState`: Dynamic algorithmic state: `UNVISITED`, `FRONTIER`, `ACTIVE`, `CLOSED`.
  3. `inPath`: Orthogonal boolean ribbon indicating final path membership.
- **Integer Destination Entry Cost Model**:
  $$\text{cost}(u \to v) = \text{weight}(v)$$
  No floating-point or scaled-by-1000 cost representations.
- **Four Cardinal Directions Only**: Strictly `UP → RIGHT → DOWN → LEFT` (no diagonal transitions).
- **Deterministic Node Identifiers**: Strictly `r{row}c{col}` format (e.g. `r0c0`, `r4c4`).
- **Trace Event Taxonomy**:
  `INITIALIZE`, `ENQUEUE_FRONTIER`, `DEQUEUE_FRONTIER`, `EXAMINE_NODE`, `UPDATE_METRICS`, `CLOSE_NODE`, `DECREASE_KEY`, `PATH_FOUND`, `NO_PATH_FOUND`.
- **Reversible Trace Deltas & Physical Heap Swap Trails**:
  Every step captures complete `beforeState` and `afterState`, plus physical min-heap swap trails (`heapSwaps`) and keyframe snapshots every 50 steps ($K=50$) for $O(1)$ scrubbing and fast-forwarding.
- **Deterministic Frontier & Tie-Breaking**:
  - BFS: FIFO Queue.
  - DFS: LIFO Stack with reverse push order (`LEFT, DOWN, RIGHT, UP`) resulting in examination order `UP, RIGHT, DOWN, LEFT`.
  - Dijkstra: Indexed Min-Heap with comparator `(gCost, 0, enqueueSequence)`. No row/column coordinate tie-breaking.
  - A*: Indexed Min-Heap with comparator `(fCost, hCost, enqueueSequence)` using integer Manhattan heuristic.
  - Decrease-key operations strictly preserve original enqueue sequence.
- **Database Decoupling**:
  Core pathfinding computation runs purely in-memory and readiness probe (`GET /api/v1/health/ready`) returns `200 OK` regardless of database availability. In Phase 1, `InMemoryPresetAdapter` is fully operational; `MySqlPresetAdapter` and `MongoPresetAdapter` serve as architectural boundaries (`PENDING`), returning RFC 9457 503 Problem Details when accessed.

## Verified Dependency Matrix

| Component | Framework / Tool | Verified GA Version | Status |
|-----------|------------------|---------------------|--------|
| Specification | OpenAPI | 3.2.0 | Canonical Contract |
| Schemas | JSON Schema | Draft 2020-12 | Canonical Schemas |
| Node.js Runner | Node.js / npm | v24.14.1 / 11.11.0 | Installed & Tested |
| Test Validation | Ajv | 8.17.1 (Draft 2020-12) | Installed & Tested |
| Spring Boot Backend | Java / Spring Boot | Java 21 LTS / 3.2.5 | Compiled & Tested (6/6 passing) |
| .NET Backend | .NET SDK / C# | .NET 9.0.311 / C# 13 | Compiled & Tested (6/6 passing) |
| React Frontend | React / Vite | React 19.0.0 / Vite 6.4.6 | Installed & Built Cleanly |
| Angular Frontend | Angular | Angular 19.2.0 | Scaffolded & Contract-Aligned |
| MySQL | Oracle MySQL | 8.4 LTS | Container Profile Configured |
| MongoDB | MongoDB Server | 8.0 | Container Profile Configured |
