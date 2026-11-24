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
            var candidate = Path.Combine(currentDir.FullName, "contracts", "fixtures", filename);
            if (File.Exists(candidate))
            {
                string json = File.ReadAllText(candidate);
                return JsonDocument.Parse(json);
            }
            currentDir = currentDir.Parent;
        }

        throw new FileNotFoundException($"Fixture file {filename} could not be located starting from {AppContext.BaseDirectory}.");
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

        // Full Reversibility Invariant Verification:
        // 1. Recreate initial state map
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
}
