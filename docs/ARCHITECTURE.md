# AETHERIS Architecture Specification

**Revision:** 2.1.0  
**Status:** Approved & Authorized  
**Domain:** Cross-Platform Deterministic Pathfinding Engine & Algorithmic Visualizer

## 1. Monorepo Architecture Overview

AETHERIS demonstrates algorithmic symmetry across polyglot stacks. 
It supports 2 frontends, 2 backends, and 2 database persistence engines in 8 combinatoric configurations.

```
                      +-------------------+
                      | OpenAPI Contract  |
                      |   (Revision 2.1)  |
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
        | Spring Boot |                   |   .NET 9    |
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
   - `EMPTY`: Traversable default cell (weight = 1.0).
   - `WALL`: Non-traversable obstacle.
   - `START`: Path starting origin.
   - `TARGET`: Path target destination.
   - `WEIGHTED`: Traversable cell with weight > 1.0 (e.g. 5.0).
2. **`traversalState`**: Dynamic state during algorithmic exploration.
   - `UNVISITED`: Not yet discovered.
   - `IN_FRONTIER`: Enqueued/pushed/heaped in frontier.
   - `VISITED`: Dequeued/popped and explored.
3. **`inPath`**: Final boolean flag indicating whether the cell belongs to the reconstructed optimal path.

### 2.3 Strict Neighbor Exploration & Tie-Breaking
To ensure 100% byte-for-byte identical trace deltas between Java (Spring Boot) and C# (.NET):
- **4-Directional Movement**:
  1. `UP`:    `(-1,  0)`
  2. `RIGHT`: `( 0, +1)`
  3. `DOWN`:  `(+1,  0)`
  4. `LEFT`:  `( 0, -1)`
- **Frontier Structures**:
  - **BFS**: FIFO Queue (`java.util.ArrayDeque` / `System.Collections.Generic.Queue<T>`).
  - **DFS**: LIFO Stack (`java.util.ArrayDeque` / `System.Collections.Generic.Stack<T>`). Neighbors are visited in order UP, RIGHT, DOWN, LEFT.
  - **Dijkstra & A***: Deterministic Indexed Min-Heap.
    - Primary key: `f(n)` (lowest cost first). For Dijkstra, `f(n) = g(n)`.
    - Secondary tie-break (A*): `h(n)` (lower heuristic distance to target first).
    - Tertiary tie-break: Insertion sequence counter (`insertionOrder`, ascending FIFO).
    - Quaternary tie-break: Coordinate order `(row, col)`.
- **Heuristic**: Manhattan Distance `|row - targetRow| + |col - targetCol|`.

### 2.4 Reversible Frontier & Reversible Trace Deltas
Every operation performed during pathfinding emits a reversible `TraceDelta`:
- `step`: 0-based integer sequence.
- `nodeId`: Target node identifier `r{row}c{col}`.
- `action`: `ENQUEUE`, `DEQUEUE`, `VISIT`, `UPDATE_COST`, `SET_PARENT`, `MARK_PATH`.
- `beforeState`: Complete snapshot of properties prior to the step.
- `afterState`: Complete snapshot of properties following the step.
- Forward stepping applies `afterState`. Backward stepping applies `beforeState`. No re-computation is necessary.

### 2.5 Persistence Decoupling
Pathfinding algorithms are pure in-memory computations and do NOT depend on MySQL or MongoDB being alive. Persistence is isolated to `IPresetRepository` and `IRunHistoryRepository` via Hexagonal Ports & Adapters, with an `InMemoryPresetAdapter` available as a fallback.
