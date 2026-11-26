using Aetheris.Core.Algorithm;
using Aetheris.Core.Domain;
using Aetheris.Core.Frontier;
using Xunit;

namespace Aetheris.Tests;

public class PathfindingComprehensiveTests
{
    private readonly PathfindingEngine _engine = new();

    // =========================================================================
    // 1. INPUT VALIDATION TESTS
    // =========================================================================

    [Fact]
    public void RejectNullRequest()
    {
        Assert.Throws<ArgumentException>(() => _engine.Execute(null!));
    }

    [Fact]
    public void RejectNullGrid()
    {
        var request = new PathfindingRequest(AlgorithmType.BFS, null!);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectRowsBelowMinimum()
    {
        var grid = new GridModel(0, 5, "r0c0", "r0c4", null);
        var request = new PathfindingRequest(AlgorithmType.BFS, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectColsAboveMaximum()
    {
        var grid = new GridModel(5, 201, "r0c0", "r4c4", null);
        var request = new PathfindingRequest(AlgorithmType.BFS, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectStartOutOfBounds()
    {
        var grid = new GridModel(5, 5, "r5c0", "r4c4", null);
        var request = new PathfindingRequest(AlgorithmType.BFS, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectTargetOutOfBounds()
    {
        var grid = new GridModel(5, 5, "r0c0", "r0c5", null);
        var request = new PathfindingRequest(AlgorithmType.BFS, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectMalformedNodeId()
    {
        var grid = new GridModel(5, 5, "invalid", "r4c4", null);
        var request = new PathfindingRequest(AlgorithmType.BFS, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectStartOnWall()
    {
        var cells = new List<CellDefinition>
        {
            new("r0c0", 0, 0, CellType.WALL, 1)
        };
        var grid = new GridModel(5, 5, "r0c0", "r4c4", cells);
        var request = new PathfindingRequest(AlgorithmType.BFS, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectTargetOnWall()
    {
        var cells = new List<CellDefinition>
        {
            new("r4c4", 4, 4, CellType.WALL, 1)
        };
        var grid = new GridModel(5, 5, "r0c0", "r4c4", cells);
        var request = new PathfindingRequest(AlgorithmType.BFS, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectWeightBelowMinimum()
    {
        var cells = new List<CellDefinition>
        {
            new("r2c2", 2, 2, CellType.WEIGHTED, 1)
        };
        var grid = new GridModel(5, 5, "r0c0", "r4c4", cells);
        var request = new PathfindingRequest(AlgorithmType.DIJKSTRA, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    [Fact]
    public void RejectWeightAboveMaximum()
    {
        var cells = new List<CellDefinition>
        {
            new("r2c2", 2, 2, CellType.WEIGHTED, 101)
        };
        var grid = new GridModel(5, 5, "r0c0", "r4c4", cells);
        var request = new PathfindingRequest(AlgorithmType.DIJKSTRA, grid);
        Assert.Throws<ArgumentException>(() => _engine.Execute(request));
    }

    // =========================================================================
    // 2. INDEXED MIN-HEAP UNIT TESTS
    // =========================================================================

    [Fact]
    public void TestHeapEmpty()
    {
        var heap = new IndexedMinHeapFrontier(false);
        Assert.Equal(0, heap.Count);
        Assert.Empty(heap.GetFrontierIds());
        Assert.Throws<InvalidOperationException>(() => heap.Pop());
    }

    [Fact]
    public void TestHeapSingleElement()
    {
        var heap = new IndexedMinHeapFrontier(false);
        var node = new IndexedMinHeapFrontier.HeapNode("r0c0", 0, 0, 5, 0, 5, 1);
        heap.Push(node);
        Assert.Equal(1, heap.Count);
        Assert.True(heap.Contains("r0c0"));

        var popped = heap.Pop();
        Assert.NotNull(popped);
        Assert.Equal("r0c0", popped.Id);
        Assert.Equal(0, heap.Count);
        Assert.False(heap.Contains("r0c0"));
    }

    [Fact]
    public void TestHeapTwoElements()
    {
        var heap = new IndexedMinHeapFrontier(false);
        var nodeA = new IndexedMinHeapFrontier.HeapNode("nodeA", 0, 0, 10, 0, 10, 1);
        var nodeB = new IndexedMinHeapFrontier.HeapNode("nodeB", 0, 1, 3, 0, 3, 2);
        heap.Push(nodeA);
        heap.Push(nodeB);

        Assert.Equal("nodeB", heap.Pop().Id);
        Assert.Equal("nodeA", heap.Pop().Id);
        Assert.Equal(0, heap.Count);
    }

    [Fact]
    public void TestHeapTieBreaking()
    {
        // Dijkstra tie-break by Seq
        var dijkstraHeap = new IndexedMinHeapFrontier(false);
        dijkstraHeap.Push(new IndexedMinHeapFrontier.HeapNode("first", 0, 0, 5, 0, 5, 10));
        dijkstraHeap.Push(new IndexedMinHeapFrontier.HeapNode("second", 0, 1, 5, 0, 5, 20));
        dijkstraHeap.Push(new IndexedMinHeapFrontier.HeapNode("third", 0, 2, 5, 0, 5, 30));

        Assert.Equal("first", dijkstraHeap.Pop().Id);
        Assert.Equal("second", dijkstraHeap.Pop().Id);
        Assert.Equal("third", dijkstraHeap.Pop().Id);

        // A* tie-break by FCost, then HCost, then Seq
        var astarHeap = new IndexedMinHeapFrontier(true);
        astarHeap.Push(new IndexedMinHeapFrontier.HeapNode("a_high_h", 0, 0, 3, 7, 10, 1));
        astarHeap.Push(new IndexedMinHeapFrontier.HeapNode("a_low_h", 0, 1, 6, 4, 10, 2));
        astarHeap.Push(new IndexedMinHeapFrontier.HeapNode("a_same_h_later", 0, 2, 6, 4, 10, 3));

        Assert.Equal("a_low_h", astarHeap.Pop().Id);
        Assert.Equal("a_same_h_later", astarHeap.Pop().Id);
        Assert.Equal("a_high_h", astarHeap.Pop().Id);
    }

    [Fact]
    public void TestHeapDecreaseKeyAndSwapTrail()
    {
        var heap = new IndexedMinHeapFrontier(false);
        heap.Push(new IndexedMinHeapFrontier.HeapNode("node1", 0, 0, 10, 0, 10, 1));
        heap.Push(new IndexedMinHeapFrontier.HeapNode("node2", 0, 1, 20, 0, 20, 2));
        heap.Push(new IndexedMinHeapFrontier.HeapNode("node3", 0, 2, 30, 0, 30, 3));

        heap.DrainSwaps();

        // Decrease node2 from 20 to 5 (bubbles above node1)
        heap.DecreaseKey("node2", 5, 5);
        var swaps = heap.DrainSwaps();
        Assert.NotEmpty(swaps);

        // Decrease node3 from 30 to 2 (bubbles to root above node2)
        heap.DecreaseKey("node3", 2, 2);
        swaps = heap.DrainSwaps();
        Assert.NotEmpty(swaps);

        Assert.Equal("node3", heap.Pop().Id);
        Assert.Equal("node2", heap.Pop().Id);
        Assert.Equal("node1", heap.Pop().Id);
    }

    // =========================================================================
    // 3. ALGORITHMIC DIVERGENCE & SEMANTIC ACCURACY
    // =========================================================================

    [Fact]
    public void TestAlgorithmDivergence()
    {
        var cells = new List<CellDefinition>
        {
            new("r0c1", 0, 1, CellType.WEIGHTED, 50),
            new("r0c2", 0, 2, CellType.WEIGHTED, 50)
        };
        var grid = new GridModel(3, 4, "r0c0", "r0c3", cells);

        // BFS strictly minimizes edge count (hops) ignoring terrain weights
        var bfsResp = _engine.Execute(new PathfindingRequest(AlgorithmType.BFS, grid));
        Assert.True(bfsResp.PathFound);
        Assert.Equal(3, bfsResp.PathEdgeCount);
        Assert.Equal(new List<string> { "r0c0", "r0c1", "r0c2", "r0c3" }, bfsResp.Path);
        Assert.Equal(101, bfsResp.TerrainPathCost);

        // Dijkstra minimizes terrain cost, choosing the detour
        var dijkstraResp = _engine.Execute(new PathfindingRequest(AlgorithmType.DIJKSTRA, grid));
        Assert.True(dijkstraResp.PathFound);
        Assert.Equal(5, dijkstraResp.PathEdgeCount);
        Assert.Equal(new List<string> { "r0c0", "r1c0", "r1c1", "r1c2", "r1c3", "r0c3" }, dijkstraResp.Path);
        Assert.Equal(5, dijkstraResp.TerrainPathCost);

        // A* also finds the optimal terrain path (cost 5)
        var astarResp = _engine.Execute(new PathfindingRequest(AlgorithmType.ASTAR, grid));
        Assert.True(astarResp.PathFound);
        Assert.Equal(5, astarResp.TerrainPathCost);
    }

    [Fact]
    public void TestDfsDeterministicExploration()
    {
        var grid = new GridModel(3, 3, "r0c0", "r2c2", null);
        var dfsResp = _engine.Execute(new PathfindingRequest(AlgorithmType.DFS, grid));
        Assert.True(dfsResp.PathFound);
        Assert.NotEmpty(dfsResp.Path);

        // Verify path continuity
        var path = dfsResp.Path;
        Assert.Equal("r0c0", path[0]);
        Assert.Equal("r2c2", path[^1]);
        for (int i = 0; i < path.Count - 1; i++)
        {
            var (r1, c1) = NodeIdUtil.Parse(path[i]);
            var (r2, c2) = NodeIdUtil.Parse(path[i + 1]);
            Assert.Equal(1, Math.Abs(r1 - r2) + Math.Abs(c1 - c2));
        }
    }
}
