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

    [Fact]
    public void TestBfsFixture()
    {
        using var doc = LoadFixture("bfs.fixture.json");
        var root = doc.RootElement;
        var grid = root.GetProperty("grid").Deserialize<GridModel>(_jsonOptions)!;

        var request = new PathfindingRequest(AlgorithmType.BFS, grid);
        var response = _engine.Execute(request);

        var expected = root.GetProperty("expectedOutcome");
        Assert.True(response.PathFound);

        var expectedPath = expected.GetProperty("path").EnumerateArray().Select(x => x.GetString()!).ToList();
        Assert.Equal(expectedPath, response.Path);
        Assert.Equal(expected.GetProperty("pathCost").GetDouble(), response.PathCost, 6);
        Assert.Equal(expected.GetProperty("pathLength").GetInt32(), response.Path.Count);
        Assert.Equal(expected.GetProperty("nodesVisited").GetInt32(), response.Metrics.NodesVisited);
        Assert.Equal(expected.GetProperty("totalTraceDeltas").GetInt32(), response.TraceDeltas.Count);
    }

    [Fact]
    public void TestDfsFixture()
    {
        using var doc = LoadFixture("dfs.fixture.json");
        var root = doc.RootElement;
        var grid = root.GetProperty("grid").Deserialize<GridModel>(_jsonOptions)!;

        var request = new PathfindingRequest(AlgorithmType.DFS, grid);
        var response = _engine.Execute(request);

        var expected = root.GetProperty("expectedOutcome");
        Assert.True(response.PathFound);

        var expectedPath = expected.GetProperty("path").EnumerateArray().Select(x => x.GetString()!).ToList();
        Assert.Equal(expectedPath, response.Path);
        Assert.Equal(expected.GetProperty("pathCost").GetDouble(), response.PathCost, 6);
        Assert.Equal(expected.GetProperty("pathLength").GetInt32(), response.Path.Count);
        Assert.Equal(expected.GetProperty("nodesVisited").GetInt32(), response.Metrics.NodesVisited);
        Assert.Equal(expected.GetProperty("totalTraceDeltas").GetInt32(), response.TraceDeltas.Count);
    }

    [Fact]
    public void TestDijkstraFixture()
    {
        using var doc = LoadFixture("dijkstra.fixture.json");
        var root = doc.RootElement;
        var grid = root.GetProperty("grid").Deserialize<GridModel>(_jsonOptions)!;

        var request = new PathfindingRequest(AlgorithmType.DIJKSTRA, grid);
        var response = _engine.Execute(request);

        var expected = root.GetProperty("expectedOutcome");
        Assert.True(response.PathFound);

        var expectedPath = expected.GetProperty("path").EnumerateArray().Select(x => x.GetString()!).ToList();
        Assert.Equal(expectedPath, response.Path);
        Assert.Equal(expected.GetProperty("pathCost").GetDouble(), response.PathCost, 6);
        Assert.Equal(expected.GetProperty("pathLength").GetInt32(), response.Path.Count);
        Assert.Equal(expected.GetProperty("nodesVisited").GetInt32(), response.Metrics.NodesVisited);
        Assert.Equal(expected.GetProperty("totalTraceDeltas").GetInt32(), response.TraceDeltas.Count);
    }

    [Fact]
    public void TestAStarFixture()
    {
        using var doc = LoadFixture("astar.fixture.json");
        var root = doc.RootElement;
        var grid = root.GetProperty("grid").Deserialize<GridModel>(_jsonOptions)!;

        var request = new PathfindingRequest(AlgorithmType.ASTAR, grid);
        var response = _engine.Execute(request);

        var expected = root.GetProperty("expectedOutcome");
        Assert.True(response.PathFound);

        var expectedPath = expected.GetProperty("path").EnumerateArray().Select(x => x.GetString()!).ToList();
        Assert.Equal(expectedPath, response.Path);
        Assert.Equal(expected.GetProperty("pathCost").GetDouble(), response.PathCost, 6);
        Assert.Equal(expected.GetProperty("pathLength").GetInt32(), response.Path.Count);
        Assert.Equal(expected.GetProperty("nodesVisited").GetInt32(), response.Metrics.NodesVisited);
        Assert.Equal(expected.GetProperty("totalTraceDeltas").GetInt32(), response.TraceDeltas.Count);
    }
}
