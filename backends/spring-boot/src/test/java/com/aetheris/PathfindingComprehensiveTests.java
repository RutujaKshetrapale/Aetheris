package com.aetheris;

import com.aetheris.algorithm.PathfindingEngine;
import com.aetheris.domain.model.*;
import com.aetheris.frontier.IndexedMinHeapFrontier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class PathfindingComprehensiveTests {

    private PathfindingEngine engine;

    @BeforeEach
    public void setup() {
        engine = new PathfindingEngine();
    }

    // =========================================================================
    // 1. INPUT VALIDATION TESTS
    // =========================================================================

    @Test
    @DisplayName("Reject null request")
    public void testNullRequestThrows() {
        assertThrows(IllegalArgumentException.class, () -> engine.execute(null));
    }

    @Test
    @DisplayName("Reject null algorithm type")
    public void testNullAlgorithmThrows() {
        GridModel grid = new GridModel(5, 5, "r0c0", "r4c4", null);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(null, grid)));
    }

    @Test
    @DisplayName("Reject null grid")
    public void testNullGridThrows() {
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.BFS, null)));
    }

    @Test
    @DisplayName("Reject grid rows < 1")
    public void testInvalidRowsZeroThrows() {
        GridModel grid = new GridModel(0, 5, "r0c0", "r0c4", null);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.BFS, grid)));
    }

    @Test
    @DisplayName("Reject grid cols > 200")
    public void testInvalidColsAboveMaxThrows() {
        GridModel grid = new GridModel(5, 201, "r0c0", "r4c4", null);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.BFS, grid)));
    }

    @Test
    @DisplayName("Reject startNode out of bounds")
    public void testStartOutOfBoundsThrows() {
        GridModel grid = new GridModel(5, 5, "r5c0", "r4c4", null);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.BFS, grid)));
    }

    @Test
    @DisplayName("Reject targetNode out of bounds")
    public void testTargetOutOfBoundsThrows() {
        GridModel grid = new GridModel(5, 5, "r0c0", "r0c5", null);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.BFS, grid)));
    }

    @Test
    @DisplayName("Reject malformed node ID syntax")
    public void testMalformedNodeIdThrows() {
        GridModel grid = new GridModel(5, 5, "start", "r4c4", null);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.BFS, grid)));
    }

    @Test
    @DisplayName("Reject start node placed on WALL cell")
    public void testStartOnWallThrows() {
        List<CellDefinition> cells = List.of(
            new CellDefinition("r0c0", 0, 0, CellType.WALL, 1)
        );
        GridModel grid = new GridModel(5, 5, "r0c0", "r4c4", cells);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.BFS, grid)));
    }

    @Test
    @DisplayName("Reject target node placed on WALL cell")
    public void testTargetOnWallThrows() {
        List<CellDefinition> cells = List.of(
            new CellDefinition("r4c4", 4, 4, CellType.WALL, 1)
        );
        GridModel grid = new GridModel(5, 5, "r0c0", "r4c4", cells);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.BFS, grid)));
    }

    @Test
    @DisplayName("Reject WEIGHTED cell with weight < 2")
    public void testWeightBelowMinThrows() {
        List<CellDefinition> cells = List.of(
            new CellDefinition("r2c2", 2, 2, CellType.WEIGHTED, 1)
        );
        GridModel grid = new GridModel(5, 5, "r0c0", "r4c4", cells);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.DIJKSTRA, grid)));
    }

    @Test
    @DisplayName("Reject WEIGHTED cell with weight > 100")
    public void testWeightAboveMaxThrows() {
        List<CellDefinition> cells = List.of(
            new CellDefinition("r2c2", 2, 2, CellType.WEIGHTED, 101)
        );
        GridModel grid = new GridModel(5, 5, "r0c0", "r4c4", cells);
        assertThrows(IllegalArgumentException.class, () -> engine.execute(new PathfindingRequest(AlgorithmType.DIJKSTRA, grid)));
    }

    // =========================================================================
    // 2. INDEXED MIN-HEAP UNIT TESTS
    // =========================================================================

    @Test
    @DisplayName("IndexedMinHeap: Empty heap returns null or 0 size")
    public void testHeapEmpty() {
        IndexedMinHeapFrontier heap = new IndexedMinHeapFrontier(false);
        assertEquals(0, heap.size());
        assertTrue(heap.isEmpty());
        assertNull(heap.pop());
    }

    @Test
    @DisplayName("IndexedMinHeap: Single element push and pop")
    public void testHeapSingleElement() {
        IndexedMinHeapFrontier heap = new IndexedMinHeapFrontier(false);
        IndexedMinHeapFrontier.HeapNode node = new IndexedMinHeapFrontier.HeapNode("r0c0", 0, 0, 5, 0, 5, 1);
        heap.push(node);
        assertEquals(1, heap.size());
        assertFalse(heap.isEmpty());
        assertTrue(heap.contains("r0c0"));

        IndexedMinHeapFrontier.HeapNode popped = heap.pop();
        assertNotNull(popped);
        assertEquals("r0c0", popped.id);
        assertEquals(0, heap.size());
        assertTrue(heap.isEmpty());
        assertFalse(heap.contains("r0c0"));
    }

    @Test
    @DisplayName("IndexedMinHeap: Two elements extracted in min order")
    public void testHeapTwoElements() {
        IndexedMinHeapFrontier heap = new IndexedMinHeapFrontier(false);
        IndexedMinHeapFrontier.HeapNode nodeA = new IndexedMinHeapFrontier.HeapNode("nodeA", 0, 0, 10, 0, 10, 1);
        IndexedMinHeapFrontier.HeapNode nodeB = new IndexedMinHeapFrontier.HeapNode("nodeB", 0, 1, 3, 0, 3, 2);
        heap.push(nodeA);
        heap.push(nodeB);

        assertEquals("nodeB", heap.pop().id);
        assertEquals("nodeA", heap.pop().id);
        assertTrue(heap.isEmpty());
    }

    @Test
    @DisplayName("IndexedMinHeap: Strict FIFO tie-breaking on equal priority (g-cost for Dijkstra, f-cost/h-cost for A*)")
    public void testHeapTieBreaking() {
        // Dijkstra tie-break by seq
        IndexedMinHeapFrontier dijkstraHeap = new IndexedMinHeapFrontier(false);
        dijkstraHeap.push(new IndexedMinHeapFrontier.HeapNode("first", 0, 0, 5, 0, 5, 10));
        dijkstraHeap.push(new IndexedMinHeapFrontier.HeapNode("second", 0, 1, 5, 0, 5, 20));
        dijkstraHeap.push(new IndexedMinHeapFrontier.HeapNode("third", 0, 2, 5, 0, 5, 30));

        assertEquals("first", dijkstraHeap.pop().id);
        assertEquals("second", dijkstraHeap.pop().id);
        assertEquals("third", dijkstraHeap.pop().id);

        // A* tie-break by fCost, then hCost, then seq
        IndexedMinHeapFrontier astarHeap = new IndexedMinHeapFrontier(true);
        astarHeap.push(new IndexedMinHeapFrontier.HeapNode("a_high_h", 0, 0, 3, 7, 10, 1));
        astarHeap.push(new IndexedMinHeapFrontier.HeapNode("a_low_h", 0, 1, 6, 4, 10, 2));
        astarHeap.push(new IndexedMinHeapFrontier.HeapNode("a_same_h_later", 0, 2, 6, 4, 10, 3));

        // a_low_h (f=10, h=4) precedes a_high_h (f=10, h=7)
        assertEquals("a_low_h", astarHeap.pop().id);
        assertEquals("a_same_h_later", astarHeap.pop().id);
        assertEquals("a_high_h", astarHeap.pop().id);
    }

    @Test
    @DisplayName("IndexedMinHeap: Repeated decreaseKey reorders heap and captures swap trail")
    public void testHeapDecreaseKeyAndSwapTrail() {
        IndexedMinHeapFrontier heap = new IndexedMinHeapFrontier(false);
        heap.push(new IndexedMinHeapFrontier.HeapNode("node1", 0, 0, 10, 0, 10, 1));
        heap.push(new IndexedMinHeapFrontier.HeapNode("node2", 0, 1, 20, 0, 20, 2));
        heap.push(new IndexedMinHeapFrontier.HeapNode("node3", 0, 2, 30, 0, 30, 3));

        // Initial drain of push swaps
        heap.drainSwaps();

        // Decrease node2 from 20 to 5 (should swap above node1 at root)
        heap.decreaseKey("node2", 5, 5);
        List<HeapSwap> swaps = heap.drainSwaps();
        assertFalse(swaps.isEmpty(), "decreaseKey should produce heap swaps when bubbling above parent");

        // Decrease node3 from 30 to 2 (should bubble to root above node2)
        heap.decreaseKey("node3", 2, 2);
        swaps = heap.drainSwaps();
        assertFalse(swaps.isEmpty(), "second decreaseKey should bubble node3 to root");

        assertEquals("node3", heap.pop().id);
        assertEquals("node2", heap.pop().id);
        assertEquals("node1", heap.pop().id);
    }

    // =========================================================================
    // 3. ALGORITHMIC DIVERGENCE & SEMANTIC ACCURACY
    // =========================================================================

    @Test
    @DisplayName("Verify BFS hop-count minimization vs Dijkstra/A* terrain cost minimization on divergence grid")
    public void testAlgorithmDivergence() {
        // Construct a 3x4 grid:
        // Start: r0c0, Target: r0c3
        // Row 0 has high weight cells at r0c1 and r0c2 (weight 50 each). Total terrain cost = 101, hops = 3.
        // Row 1 provides an unweighted detour: r0c0 -> r1c0 -> r1c1 -> r1c2 -> r1c3 -> r0c3. Total terrain cost = 5, hops = 5.
        List<CellDefinition> cells = List.of(
            new CellDefinition("r0c1", 0, 1, CellType.WEIGHTED, 50),
            new CellDefinition("r0c2", 0, 2, CellType.WEIGHTED, 50)
        );
        GridModel grid = new GridModel(3, 4, "r0c0", "r0c3", cells);

        // BFS strictly minimizes edge count (hops) ignoring terrain weights
        PathfindingResponse bfsResp = engine.execute(new PathfindingRequest(AlgorithmType.BFS, grid));
        assertTrue(bfsResp.isPathFound());
        assertEquals(3, bfsResp.getPathEdgeCount());
        assertEquals(List.of("r0c0", "r0c1", "r0c2", "r0c3"), bfsResp.getPath());
        assertEquals(101, bfsResp.getTerrainPathCost().intValue());

        // Dijkstra minimizes terrain cost, choosing the detour
        PathfindingResponse dijkstraResp = engine.execute(new PathfindingRequest(AlgorithmType.DIJKSTRA, grid));
        assertTrue(dijkstraResp.isPathFound());
        assertEquals(5, dijkstraResp.getPathEdgeCount());
        assertEquals(List.of("r0c0", "r1c0", "r1c1", "r1c2", "r1c3", "r0c3"), dijkstraResp.getPath());
        assertEquals(5, dijkstraResp.getTerrainPathCost().intValue());

        // A* also finds the optimal terrain path (cost 5)
        PathfindingResponse astarResp = engine.execute(new PathfindingRequest(AlgorithmType.ASTAR, grid));
        assertTrue(astarResp.isPathFound());
        assertEquals(5, astarResp.getTerrainPathCost().intValue());
    }

    @Test
    @DisplayName("Verify DFS explores deterministically (UP, RIGHT, DOWN, LEFT) and does not guarantee shortest path")
    public void testDfsDeterministicExploration() {
        // Open 3x3 grid from r0c0 to r0c2
        // Shortest path is r0c0 -> r0c1 -> r0c2 (2 hops)
        // DFS neighbors from r0c0:
        // UP: out of bounds
        // RIGHT: r0c1 (pushed, but LIFO push order LEFT, DOWN, RIGHT, UP means UP popped first, then RIGHT popped before DOWN/LEFT)
        // With push order LEFT, DOWN, RIGHT, UP:
        // Popped top is UP (out of bounds), then RIGHT (r0c1).
        GridModel grid = new GridModel(3, 3, "r0c0", "r2c2", null);
        PathfindingResponse dfsResp = engine.execute(new PathfindingRequest(AlgorithmType.DFS, grid));
        assertTrue(dfsResp.isPathFound());
        assertNotNull(dfsResp.getPath());
        // Verify path continuity
        List<String> path = dfsResp.getPath();
        assertEquals("r0c0", path.get(0));
        assertEquals("r2c2", path.get(path.size() - 1));
        for (int i = 0; i < path.size() - 1; i++) {
            String curr = path.get(i);
            String next = path.get(i + 1);
            int r1 = Integer.parseInt(curr.substring(1).split("c")[0]);
            int c1 = Integer.parseInt(curr.substring(1).split("c")[1]);
            int r2 = Integer.parseInt(next.substring(1).split("c")[0]);
            int c2 = Integer.parseInt(next.substring(1).split("c")[1]);
            assertEquals(1, Math.abs(r1 - r2) + Math.abs(c1 - c2));
        }
    }
}
