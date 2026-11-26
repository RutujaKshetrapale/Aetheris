using System.Text.Json;
using Aetheris.Core.Algorithm;
using Aetheris.Core.Domain;
using Xunit;

namespace Aetheris.Tests;

public class PathfindingFixtureTests
{
    private readonly PathfindingEngine _engine = new();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static JsonDocument LoadFixture(string filename)
    {
        var currentDir = new DirectoryInfo(AppContext.BaseDirectory);
        while (currentDir != null)
        {
            var candidate1 = Path.Combine(currentDir.FullName, "contracts", "fixtures", "pathfinding", filename);
            if (File.Exists(candidate1))
            {
                return JsonDocument.Parse(File.ReadAllText(candidate1));
            }
            var candidate2 = Path.Combine(currentDir.FullName, "contracts", "fixtures", filename);
            if (File.Exists(candidate2))
            {
                return JsonDocument.Parse(File.ReadAllText(candidate2));
            }
            currentDir = currentDir.Parent;
        }

        throw new FileNotFoundException($"Fixture file {filename} could not be located starting from {AppContext.BaseDirectory}.");
    }

    private static (int Row, int Col) ParseNode(string id)
    {
        string numPart = id[1..];
        string[] parts = numPart.Split('c');
        return (int.Parse(parts[0]), int.Parse(parts[1]));
    }

    private void VerifyFixture(string filename, AlgorithmType expectedAlgo)
    {
        using var doc = LoadFixture(filename);
        var root = doc.RootElement;
        var grid = root.GetProperty("grid").Deserialize<GridModel>(_jsonOptions)!;

        var request = new PathfindingRequest(expectedAlgo, grid);
        var response = _engine.Execute(request);

        var expected = root.GetProperty("expectedOutcome");
        bool expectedPathFound = expected.GetProperty("pathFound").GetBoolean();
        Assert.Equal(expectedPathFound, response.PathFound);

        var expectedPath = expected.GetProperty("path").EnumerateArray().Select(x => x.GetString()!).ToList();
        Assert.Equal(expectedPath, response.Path);

        Assert.Equal(expected.GetProperty("pathNodeCount").GetInt32(), response.PathNodeCount);
        Assert.Equal(expected.GetProperty("pathEdgeCount").GetInt32(), response.PathEdgeCount);

        if (expected.GetProperty("algorithmPathCost").ValueKind == JsonValueKind.Null)
        {
            Assert.Null(response.AlgorithmPathCost);
        }
        else
        {
            Assert.Equal(expected.GetProperty("algorithmPathCost").GetInt32(), response.AlgorithmPathCost);
        }

        if (expected.GetProperty("terrainPathCost").ValueKind == JsonValueKind.Null)
        {
            Assert.Null(response.TerrainPathCost);
        }
        else
        {
            Assert.Equal(expected.GetProperty("terrainPathCost").GetInt32(), response.TerrainPathCost);
        }

        Assert.Equal(expected.GetProperty("nodesVisited").GetInt32(), response.Metrics.NodesVisited);
        Assert.Equal(expected.GetProperty("totalSteps").GetInt32(), response.TraceDeltas.Count);

        if (expected.GetProperty("noPathReason").ValueKind == JsonValueKind.Null)
        {
            Assert.Null(response.NoPathReason);
        }
        else
        {
            Assert.Equal(expected.GetProperty("noPathReason").GetString(), response.NoPathReason);
        }

        // 1. Path Continuity and Non-Diagonal Invariant Check
        if (response.PathFound)
        {
            var path = response.Path;
            if (path.Count == 1)
            {
                Assert.Equal(grid.StartNode, path[0]);
                Assert.Equal(grid.TargetNode, path[0]);
            }
            else
            {
                Assert.Equal(grid.StartNode, path[0]);
                Assert.Equal(grid.TargetNode, path[^1]);
                for (int i = 0; i < path.Count - 1; i++)
                {
                    var (r1, c1) = ParseNode(path[i]);
                    var (r2, c2) = ParseNode(path[i + 1]);
                    int manhattanDist = Math.Abs(r1 - r2) + Math.Abs(c1 - c2);
                    Assert.Equal(1, manhattanDist);
                    Assert.True(r1 == r2 || c1 == c2, "Diagonal transitions are forbidden");
                }
            }
        }

        // 2. Physical Heap Array Reconstruction & Keyframe Verification
        var physicalFrontier = new List<string>();
        foreach (var delta in response.TraceDeltas)
        {
            if (expectedAlgo == AlgorithmType.DIJKSTRA || expectedAlgo == AlgorithmType.ASTAR)
            {
                if (delta.Action == TraceAction.INITIALIZE && delta.NodeId != null && delta.FrontierSize > 0)
                {
                    physicalFrontier.Add(delta.NodeId);
                }
                else if (delta.Action == TraceAction.ENQUEUE_FRONTIER && delta.NodeId != null)
                {
                    if (delta.OperationSubtype == "DECREASE_KEY")
                    {
                        foreach (var swap in delta.HeapSwaps)
                        {
                            var temp = physicalFrontier[swap.IndexA];
                            physicalFrontier[swap.IndexA] = physicalFrontier[swap.IndexB];
                            physicalFrontier[swap.IndexB] = temp;
                        }
                    }
                    else
                    {
                        physicalFrontier.Add(delta.NodeId);
                        foreach (var swap in delta.HeapSwaps)
                        {
                            var temp = physicalFrontier[swap.IndexA];
                            physicalFrontier[swap.IndexA] = physicalFrontier[swap.IndexB];
                            physicalFrontier[swap.IndexB] = temp;
                        }
                    }
                }
                else if (delta.Action == TraceAction.DEQUEUE_FRONTIER)
                {
                    if (physicalFrontier.Count > 0)
                    {
                        var last = physicalFrontier[^1];
                        physicalFrontier.RemoveAt(physicalFrontier.Count - 1);
                        if (physicalFrontier.Count > 0)
                        {
                            physicalFrontier[0] = last;
                        }
                    }
                    foreach (var swap in delta.HeapSwaps)
                    {
                        var temp = physicalFrontier[swap.IndexA];
                        physicalFrontier[swap.IndexA] = physicalFrontier[swap.IndexB];
                        physicalFrontier[swap.IndexB] = temp;
                    }
                }
            }
            else if (expectedAlgo == AlgorithmType.BFS)
            {
                if (delta.Action == TraceAction.ENQUEUE_FRONTIER && delta.NodeId != null)
                {
                    physicalFrontier.Add(delta.NodeId);
                }
                else if (delta.Action == TraceAction.DEQUEUE_FRONTIER && physicalFrontier.Count > 0)
                {
                    physicalFrontier.RemoveAt(0);
                }
            }
            else if (expectedAlgo == AlgorithmType.DFS)
            {
                if (delta.Action == TraceAction.ENQUEUE_FRONTIER && delta.NodeId != null)
                {
                    physicalFrontier.Add(delta.NodeId);
                }
                else if (delta.Action == TraceAction.DEQUEUE_FRONTIER && physicalFrontier.Count > 0)
                {
                    physicalFrontier.RemoveAt(physicalFrontier.Count - 1);
                }
            }

            if (delta.Step % 50 == 0 && response.Keyframes != null)
            {
                var kf = response.Keyframes.FirstOrDefault(k => k.Step == delta.Step);
                if (kf != null)
                {
                    Assert.Equal(kf.Frontier, physicalFrontier);
                }
            }
        }

        // 3. Full Bidirectional Reversibility Verification:
        var stateMap = new Dictionary<string, CellState>();
        for (int r = 0; r < grid.Rows; r++)
        {
            for (int c = 0; c < grid.Cols; c++)
            {
                string id = $"r{r}c{c}";
                var ct = CellType.EMPTY;
                if (id == grid.TargetNode) ct = CellType.TARGET;
                if (id == grid.StartNode) ct = CellType.START;
                if (grid.Cells != null)
                {
                    var custom = grid.Cells.FirstOrDefault(x => x.Id == id);
                    if (custom != null) ct = custom.CellType;
                }
                stateMap[id] = new CellState(ct, TraversalState.UNVISITED, false, null, null, null, null);
            }
        }

        // Deep clone initial snapshots
        var initialSnapshots = new Dictionary<string, CellState>();
        foreach (var kvp in stateMap)
        {
            initialSnapshots[kvp.Key] = kvp.Value.Copy();
        }

        // Forward replay: apply AfterState
        foreach (var delta in response.TraceDeltas)
        {
            if (delta.NodeId != null && delta.AfterState != null)
            {
                stateMap[delta.NodeId] = delta.AfterState.Copy();
            }
        }

        // Verify path overlay in final state
        foreach (var pId in response.Path)
        {
            Assert.True(stateMap.TryGetValue(pId, out var s) && s.InPath, $"Path node {pId} must be inPath in final state");
        }

        // Backward replay: apply BeforeState in reverse order
        for (int i = response.TraceDeltas.Count - 1; i >= 0; i--)
        {
            var delta = response.TraceDeltas[i];
            if (delta.NodeId != null && delta.BeforeState != null)
            {
                stateMap[delta.NodeId] = delta.BeforeState.Copy();
            }
        }

        // Verify exact bit-for-bit restoration to initial state
        foreach (var (id, initial) in initialSnapshots)
        {
            var restored = stateMap[id];
            Assert.Equal(initial.CellType, restored.CellType);
            Assert.Equal(initial.TraversalState, restored.TraversalState);
            Assert.Equal(initial.InPath, restored.InPath);
            Assert.Equal(initial.GCost, restored.GCost);
            Assert.Equal(initial.HCost, restored.HCost);
            Assert.Equal(initial.FCost, restored.FCost);
            Assert.Equal(initial.ParentId, restored.ParentId);
        }
    }

    [Fact]
    public void TestBfsFixture() => VerifyFixture("bfs.fixture.json", AlgorithmType.BFS);

    [Fact]
    public void TestDfsFixture() => VerifyFixture("dfs.fixture.json", AlgorithmType.DFS);

    [Fact]
    public void TestDijkstraFixture() => VerifyFixture("dijkstra.fixture.json", AlgorithmType.DIJKSTRA);

    [Fact]
    public void TestAstarFixture() => VerifyFixture("astar.fixture.json", AlgorithmType.ASTAR);

    [Fact]
    public void TestStartEqualsTargetFixture() => VerifyFixture("start-equals-target.fixture.json", AlgorithmType.DIJKSTRA);

    [Fact]
    public void TestUnreachableTargetFixture() => VerifyFixture("unreachable-target.fixture.json", AlgorithmType.BFS);

    [Fact]
    public void TestAdjacentTargetFixture() => VerifyFixture("adjacent-target.fixture.json", AlgorithmType.BFS);

    [Fact]
    public void TestCompletelyBlockedFixture() => VerifyFixture("completely-blocked.fixture.json", AlgorithmType.DFS);

    [Fact]
    public void TestOneRowFixture() => VerifyFixture("one-row.fixture.json", AlgorithmType.ASTAR);

    [Fact]
    public void TestOneColumnFixture() => VerifyFixture("one-column.fixture.json", AlgorithmType.DIJKSTRA);

    [Fact]
    public void TestMultipleEqualPathsFixture() => VerifyFixture("multiple-equal-paths.fixture.json", AlgorithmType.BFS);

    [Fact]
    public void TestWeightedDivergenceBfsFixture() => VerifyFixture("weighted-divergence-bfs.fixture.json", AlgorithmType.BFS);

    [Fact]
    public void TestWeightedDivergenceDijkstraFixture() => VerifyFixture("weighted-divergence-dijkstra.fixture.json", AlgorithmType.DIJKSTRA);

    [Fact]
    public void TestWeightedDivergenceAstarFixture() => VerifyFixture("weighted-divergence-astar.fixture.json", AlgorithmType.ASTAR);

    [Fact]
    public void TestRepeatedDecreaseKeyFixture() => VerifyFixture("repeated-decrease-key.fixture.json", AlgorithmType.DIJKSTRA);

    [Fact]
    public void TestLargeGridFixture() => VerifyFixture("large-grid.fixture.json", AlgorithmType.ASTAR);
}
