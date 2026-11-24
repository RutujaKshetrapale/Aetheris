# AETHERIS — The Art of Algorithmic Thinking

Architecture Baseline: Revision 2.1.0

AETHERIS is an algorithm visualization and exploration platform engineering showcase designed to demonstrate cross-platform deterministic pathfinding across multiple frontends (React, Angular), backends (Spring Boot, .NET 9), and persistence layers (MySQL, MongoDB).

## Monorepo Layout

```
Aetheris/
├── contracts/                  # Canonical OpenAPI 3.2.0 spec & JSON schemas
│   ├── openapi.yaml            # Canonical API contract
│   ├── schemas/                # Shared JSON schemas
│   └── fixtures/               # Deterministic pathfinding test fixtures (BFS, DFS, Dijkstra, A*)
├── frontends/
│   ├── react/                  # React 19 + TypeScript + Vite frontend
│   └── angular/                # Angular 19 + TypeScript frontend
├── backends/
│   ├── spring-boot/            # Java 21 + Spring Boot 3.4.x backend
│   └── dotnet/                 # C# 13 + .NET 9.0 Web API backend
├── deployments/
│   ├── docker/                 # Production & development Dockerfiles
│   └── configurations/         # 8 mandatory deployment configuration profiles
├── tests/
│   ├── contract-validation/    # OpenAPI & JSON Schema contract test suite
│   └── fixture-runner/         # Cross-platform deterministic fixture validator
└── docs/                       # Architecture documentation and specifications
```

## Mandatory 8 Configuration Profiles

1. **React + Spring Boot + MySQL** (`deployments/configurations/react-springboot-mysql.env`)
2. **React + Spring Boot + MongoDB** (`deployments/configurations/react-springboot-mongodb.env`)
3. **React + .NET + MySQL** (`deployments/configurations/react-dotnet-mysql.env`)
4. **React + .NET + MongoDB** (`deployments/configurations/react-dotnet-mongodb.env`)
5. **Angular + Spring Boot + MySQL** (`deployments/configurations/angular-springboot-mysql.env`)
6. **Angular + Spring Boot + MongoDB** (`deployments/configurations/angular-springboot-mongodb.env`)
7. **Angular + .NET + MySQL** (`deployments/configurations/angular-dotnet-mysql.env`)
8. **Angular + .NET + MongoDB** (`deployments/configurations/angular-dotnet-mongodb.env`)

## Core Architectural Invariants

- **Canonical API Contract**: All 8 configurations implement and consume the single OpenAPI 3.2.0 contract (`contracts/openapi.yaml`).
- **Three Independent Grid Layers**:
  1. `cellType`: EMPTY, WALL, START, TARGET, WEIGHTED.
  2. `traversalState`: UNVISITED, IN_FRONTIER, VISITED.
  3. `inPath`: boolean flag indicating final shortest/calculated path membership.
- **Deterministic Node Identifiers**: `r{row}c{col}` format (e.g., `r0c0`, `r12c34`).
- **Reversible Trace Deltas**: Every exploration step emits a delta containing explicit `beforeState` and `afterState`, allowing true bidirectional stepping without recomputation.
- **Unified Reversible Frontier Abstraction**: Common interface supporting FIFO Queue (BFS), LIFO Stack (DFS), and Deterministic Indexed Min-Heap (Dijkstra, A*).
- **Database Decoupling**: Pathfinding computation is completely independent of database availability. Persistence adapters (MySQL, MongoDB, InMemory) provide optional preset and run history storage without gating core computation.
