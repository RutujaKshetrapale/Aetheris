using System.Text.Json.Serialization;

namespace Aetheris.Core.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CellType
{
    EMPTY,
    WALL,
    START,
    TARGET,
    WEIGHTED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TraversalState
{
    UNVISITED,
    IN_FRONTIER,
    VISITED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TraceAction
{
    ENQUEUE,
    DEQUEUE,
    VISIT,
    UPDATE_COST,
    SET_PARENT,
    MARK_PATH
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AlgorithmType
{
    BFS,
    DFS,
    DIJKSTRA,
    ASTAR
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum HeuristicType
{
    MANHATTAN,
    EUCLIDEAN,
    CHEBYSHEV
}

public class CellDefinition
{
    public string Id { get; set; } = string.Empty;
    public int Row { get; set; }
    public int Col { get; set; }
    public CellType CellType { get; set; } = CellType.EMPTY;
    public double Weight { get; set; } = 1.0;

    public CellDefinition() { }

    public CellDefinition(string id, int row, int col, CellType cellType, double weight = 1.0)
    {
        Id = id;
        Row = row;
        Col = col;
        CellType = cellType;
        Weight = weight;
    }
}

public class CellState
{
    public CellType CellType { get; set; }
    public TraversalState TraversalState { get; set; }
    public bool InPath { get; set; }
    public double? GCost { get; set; }
    public double? FCost { get; set; }
    public string? ParentId { get; set; }

    public CellState() { }

    public CellState(CellType cellType, TraversalState traversalState, bool inPath, double? gCost, double? fCost, string? parentId)
    {
        CellType = cellType;
        TraversalState = traversalState;
        InPath = inPath;
        GCost = gCost;
        FCost = fCost;
        ParentId = parentId;
    }

    public CellState Copy()
    {
        return new CellState(CellType, TraversalState, InPath, GCost, FCost, ParentId);
    }
}

public class GridModel
{
    public int Rows { get; set; }
    public int Cols { get; set; }
    public string StartNode { get; set; } = string.Empty;
    public string TargetNode { get; set; } = string.Empty;
    public List<CellDefinition> Cells { get; set; } = new();

    public GridModel() { }

    public GridModel(int rows, int cols, string startNode, string targetNode, List<CellDefinition>? cells = null)
    {
        Rows = rows;
        Cols = cols;
        StartNode = startNode;
        TargetNode = targetNode;
        Cells = cells ?? new List<CellDefinition>();
    }
}

public class TraceDelta
{
    public int Step { get; set; }
    public string NodeId { get; set; } = string.Empty;
    public TraceAction Action { get; set; }
    public CellState BeforeState { get; set; } = new();
    public CellState AfterState { get; set; } = new();
    public int FrontierSize { get; set; }

    public TraceDelta() { }

    public TraceDelta(int step, string nodeId, TraceAction action, CellState beforeState, CellState afterState, int frontierSize)
    {
        Step = step;
        NodeId = nodeId;
        Action = action;
        BeforeState = beforeState;
        AfterState = afterState;
        FrontierSize = frontierSize;
    }
}

public class ExecutionMetrics
{
    public int NodesVisited { get; set; }
    public int MaxFrontierSize { get; set; }
    public double ExecutionTimeMs { get; set; }
    public int PathLength { get; set; }
    public double PathCost { get; set; }

    public ExecutionMetrics() { }

    public ExecutionMetrics(int nodesVisited, int maxFrontierSize, double executionTimeMs, int pathLength, double pathCost)
    {
        NodesVisited = nodesVisited;
        MaxFrontierSize = maxFrontierSize;
        ExecutionTimeMs = executionTimeMs;
        PathLength = pathLength;
        PathCost = pathCost;
    }
}

public class PathfindingRequest
{
    public AlgorithmType Algorithm { get; set; }
    public GridModel Grid { get; set; } = new();
    public HeuristicType Heuristic { get; set; } = HeuristicType.MANHATTAN;
    public bool AllowDiagonals { get; set; } = false;

    public PathfindingRequest() { }

    public PathfindingRequest(AlgorithmType algorithm, GridModel grid)
    {
        Algorithm = algorithm;
        Grid = grid;
    }
}

public class PathfindingResponse
{
    public AlgorithmType Algorithm { get; set; }
    public bool PathFound { get; set; }
    public List<string> Path { get; set; } = new();
    public double PathCost { get; set; }
    public List<TraceDelta> TraceDeltas { get; set; } = new();
    public ExecutionMetrics Metrics { get; set; } = new();
    public bool Reversible { get; set; } = true;
}

public class AlgorithmInfo
{
    public AlgorithmType Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool Weighted { get; set; }
    public bool GuaranteedShortestPath { get; set; }
    public string FrontierType { get; set; } = string.Empty;

    public AlgorithmInfo() { }

    public AlgorithmInfo(AlgorithmType id, string name, string description, bool weighted, bool guaranteedShortestPath, string frontierType)
    {
        Id = id;
        Name = name;
        Description = description;
        Weighted = weighted;
        GuaranteedShortestPath = guaranteedShortestPath;
        FrontierType = frontierType;
    }
}

public class GridPreset
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public GridModel Grid { get; set; } = new();
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public GridPreset() { }

    public GridPreset(string id, string name, string description, GridModel grid)
    {
        Id = id;
        Name = name;
        Description = description;
        Grid = grid;
        CreatedAt = DateTime.UtcNow.ToString("o");
    }
}

public class HealthStatus
{
    public string Status { get; set; } = "UP";
    public string Platform { get; set; } = ".NET 9.0 (C# 13)";
    public string Version { get; set; } = "2.1.0";
    public string PersistenceEngine { get; set; } = "IN_MEMORY";
    public bool DatabaseConnected { get; set; } = true;

    public HealthStatus() { }

    public HealthStatus(string status, string platform, string version, string persistenceEngine, bool databaseConnected)
    {
        Status = status;
        Platform = platform;
        Version = version;
        PersistenceEngine = persistenceEngine;
        DatabaseConnected = databaseConnected;
    }
}
