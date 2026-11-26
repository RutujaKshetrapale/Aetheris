# AETHERIS Architecture Specification

**Revision:** 2.1.0  
**Status:** Approved, Authorized & Implemented  
**Domain:** Cross-Platform Deterministic Pathfinding Engine & Algorithmic Visualizer

## 1. Monorepo Architecture Overview

AETHERIS demonstrates algorithmic symmetry across polyglot stacks. 
It supports 2 frontends, 2 backends, and 2 database persistence engines across 8 combinatoric configurations.

```
                      +-------------------+
                      | OpenAPI Contract  |
                      |   (Revision 2.1)  |
                      |   OpenAPI 3.2.0   |
                      +---------+---------+
                                |
               +----------------+----------------+
               |                                 |
        +------+------+                   +------+------+
        | React Client|                   |Angular Client|
        +------+------+                   +------+------+
               |                                 |
               +----------------+----------------+
                                |
               +----------------+----------------+
               |                                 |
        +------+------+                   +------+------+
        | Spring Boot |                   |   .NET 11   |
        |   Backend   |                   |   Backend   |
        +------+------+                   +------+------+
               |                                 |
               +----------------+----------------+
                                |
               +----------------+----------------+
               |                                 |
        +------+------+                   +------+------+
        |    MySQL    |                   |   MongoDB   |
        |   Adapter   |                   |   Adapter   |
        +-------------+                   +-------------+
```

## 2. Invariants & Determinism Rules

### 2.1 Coordinate System & Deterministic Node Identifiers
- Coordinates are 0-indexed: `(row, col)` with `0 <= row < rows` and `0 <= col < cols`.
- Node identifier format is strictly canonical: `r{row}c{col}` (e.g. `r0c0`, `r3c4`).
- Node ID string serialization is unambiguous, sortable, and reversible.

### 2.2 Three Independent Grid Layers
Every grid cell state is represented by three orthogonal concerns:
1. **`cellType`**: Structural role of cell.
   - `EMPTY`: Traversable default cell (destination entry cost = 1).
   - `WALL`: Non-traversable obstacle.
   - `START`: Path starting origin (destination entry cost = 0).
   - `TARGET`: Path target destination.
   - `WEIGHTED`: Traversable cell with integer destination entry cost from 2 to 100.
2. **`traversalState`**: Dynamic state during algorithmic exploration.
   - `UNVISITED`: Not yet discovered.
   - `FRONTIER`: Enqueued/pushed/heaped in frontier.
   - `ACTIVE`: Currently dequeued and under examination.
   - `CLOSED`: Fully examined and neighbor expansion complete.
3. **`inPath`**: Final boolean flag indicating whether the cell belongs to the reconstructed optimal path.

### 2.3 Strict Neighbor Exploration & Tie-Breaking
To ensure 100% byte-for-byte identical trace deltas between Java (Spring Boot) and C# (.NET):
- **4 Cardinal Directions Only**:
  1. `UP`:    `(-1,  0)`
  2. `RIGHT`: `( 0, +1)`
  3. `DOWN`:  `(+1,  0)`
  4. `LEFT`:  `( 0, -1)`
  Diagonal movement is strictly forbidden.
- **Frontier Structures**:
  - **BFS**: FIFO Queue (`java.util.ArrayDeque` / `System.Collections.Generic.Queue<T>`).
  - **DFS**: LIFO Stack (`java.util.ArrayDeque` / `System.Collections.Generic.Stack<T>`). Push neighbors in reverse order: `LEFT, DOWN, RIGHT, UP`, resulting in examination order `UP, RIGHT, DOWN, LEFT`.
  - **Dijkstra & A***: Deterministic Indexed Min-Heap.
    - Dijkstra comparator: `(gCost, 0, enqueueSequence)`.
    - A* comparator: `(fCost, hCost, enqueueSequence)` with integer Manhattan heuristic multiplied by min positive cost (1): `|r1 - r2| + |c1 - c2|`.
    - Strictly **NO** coordinate row/column tie-breakers after enqueue sequence.
    - Decrease-key operations strictly preserve the original enqueue sequence counter.

### 2.4 Reversible Frontier & Reversible Trace Deltas
Every operation performed during pathfinding emits a reversible `TraceDelta`:
- `step`: 0-based integer sequence.
- `action`: `INITIALIZE`, `ENQUEUE_FRONTIER`, `DEQUEUE_FRONTIER`, `EXAMINE_NODE`, `UPDATE_METRICS`, `CLOSE_NODE`, `DECREASE_KEY`, `PATH_FOUND`, `NO_PATH_FOUND`.
- `nodeId`: Target node identifier `r{row}c{col}` (or null for global actions).
- `beforeState`: Complete snapshot of cell properties prior to the step (or null).
- `afterState`: Complete snapshot of cell properties following the step (or null).
- `frontierSize`: Size of frontier after delta is recorded.
- `heapSwaps`: Physical heap swap trails `(indexA, indexB, nodeA, nodeB)` ensuring bit-for-bit heap array reversibility.
- `keyframes`: Keyframe snapshots captured every 50 steps ($K=50$) allowing $O(1)$ seeking.

### 2.5 Special Cases
- **Start Equals Target**:
  - Path contains only start node: `path = [startNode]`.
  - `pathNodeCount = 1`, `pathEdgeCount = 0`.
  - `algorithmPathCost = 0`, `terrainPathCost = 0`.
  - `nodesVisited = 1`.
  - Exactly two events: `INITIALIZE` at step 0 and `PATH_FOUND` at step 1 (`totalSteps = 2`).
- **Unreachable Target**:
  - Path is empty: `path = []`.
  - `pathNodeCount = 0`, `pathEdgeCount = 0`.
  - `algorithmPathCost = null`, `terrainPathCost = null`.
  - Final event: `NO_PATH_FOUND` with reason `FRONTIER_EXHAUSTED`.

### 2.6 Persistence Decoupling
Pathfinding algorithms are pure in-memory computations and do NOT depend on MySQL or MongoDB being alive.
- `/api/v1/health/ready`: Returns `200 OK` whenever core in-memory pathfinding engine is ready.
- In Phase 1, `InMemoryPresetAdapter` provides operational presets.
- `MySqlPresetAdapter` and `MongoPresetAdapter` represent the architectural boundary (`PENDING`), returning RFC 9457 503 `ProblemDetails` when accessed without active database infrastructure.
