# AETHERIS — The Art of Algorithmic Thinking

**Architecture Baseline:** Revision 2.1.0  
**Status:** Phase 1 Foundation Fully Established & Verified

AETHERIS is an algorithm visualization and exploration platform engineering showcase designed to demonstrate cross-platform deterministic pathfinding across multiple frontends (React, Angular), backends (Spring Boot, .NET 11), and persistence layers (MySQL, MongoDB).

## Monorepo Layout

```
Aetheris/
├── contracts/                  # Canonical OpenAPI 3.2.0 spec & JSON schemas (Draft 2020-12)
│   ├── openapi.yaml            # Canonical OpenAPI 3.2.0 API contract
│   ├── schemas/                # Shared JSON schemas (Draft 2020-12)
│   └── fixtures/               # Deterministic pathfinding test fixtures (BFS, DFS, Dijkstra, A*, start==target, unreachable)
├── frontends/
│   ├── react/                  # React 19.3.1 + TypeScript 6.0.3 + Vite 8.3.8 frontend
│   └── angular/                # Angular 22.3.0 + TypeScript 6.0.3 frontend
├── backends/
│   ├── spring-boot/            # Java 25 / 21 LTS + Spring Boot 4.2.0 GA backend
│   └── dotnet/                 # C# 13 + .NET 11.0 / 9.0 Web API backend
├── deployments/
│   ├── docker/                 # Production Dockerfiles (Node 26, Temurin 25, .NET 11) & Nginx reverse proxy
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
- **Canonical Endpoint**: `POST /api/v1/pathfinding/trace`. All error responses conform to RFC 9457 Problem Details (`application/problem+json`).
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

| Component | Target Version | Selected GA Version | Role / Environment | Status |
|-----------|----------------|---------------------|--------------------|--------|
| Specification | OpenAPI 3.2.0 | 3.2.0 | Canonical Contract (`contracts/openapi.yaml`) | Verified & Conforming (0 errors) |
| Schemas | JSON Schema Draft 2020-12 | Draft 2020-12 | Canonical Shared Schemas (10 schemas) | Verified & Compiled (0 errors) |
| Spring Boot Backend | Spring Boot 4.2.0 / Java 25 LTS | Spring Boot 4.2.0 GA / OpenJDK 25.0.5.1 LTS | `backends/spring-boot/` REST API | Compiled, Packaged & Tested on Java 25 (6/6 passing) |
| .NET Backend | .NET SDK 11.0.100 | .NET SDK 11.0.100 (net11.0) | `backends/dotnet/` Minimal API | Built, Tested & Published on .NET 11 (6/6 passing) |
| React Frontend | React 19.3.1 | React 19.3.1 GA / Vite 8.3.8 / TS 6.0.3 | `frontends/react/` Web Application | Clean Production Build on Node 26 (1.40s) |
| Angular Frontend | Angular 22.x / TS 6.0.x | Angular 22.3.0 GA / TS 6.0.3 GA | `frontends/angular/` Web Application | Clean Production Build on Node 26 (7.06s) |
| MySQL Database | MySQL 9.7 LTS | `mysql:9.7` | Container Profiles (MySQL 9.7 LTS) | Configured in 4 Compose Profiles (503 boundary stub) |
| MongoDB Database | MongoDB 9.0.x | `mongo:9.0` | Container Profiles (MongoDB 9.0 GA) | Configured in 4 Compose Profiles (503 boundary stub) |
| Toolchain / Node.js | Node.js 26.x | Node.js 26.13.1 GA | Tooling & Angular / React Build Runtime | Verified Native Host Build |
