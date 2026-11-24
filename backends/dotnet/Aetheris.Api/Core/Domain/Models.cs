using System.Text.Json.Serialization;

namespace Aetheris.Core.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CellType
{
    EMPTY,
    WALL,
    WEIGHTED,
    START,
    TARGET
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TraversalState
{
    UNVISITED,
    FRONTIER,
    ACTIVE,
    CLOSED
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TraceAction
{
    INITIALIZE,
    ENQUEUE_FRONTIER,
    DEQUEUE_FRONTIER,
    EXAMINE_NODE,
    UPDATE_METRICS,
    CLOSE_NODE,
    DECREASE_KEY,
    PATH_FOUND,
    NO_PATH_FOUND
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
    MANHATTAN
}

public class CellDefinition
{
    public string Id { get; set; } = string.Empty;
    public int Row { get; set; }
    public int Col { get; set; }
    public CellType CellType { get; set; } = CellType.EMPTY;
    public int Weight { get; set; } = 1;

    public CellDefinition() { }

    public CellDefinition(string id, int row, int col, CellType cellType, int weight = 1)
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
    public int? GCost { get; set; }
    public int? HCost { get; set; }
    public int? FCost { get; set; }
    public string? ParentId { get; set; }

    public CellState() { }

    public CellState(CellType cellType, TraversalState traversalState, bool inPath, int? gCost, int? hCost, int? fCost, string? parentId)
    {
        CellType = cellType;
        TraversalState = traversalState;
        InPath = inPath;
        GCost = gCost;
        HCost = hCost;
        FCost = fCost;
        ParentId = parentId;
    }

    public CellState Copy()
    {
        return new CellState(CellType, TraversalState, InPath, GCost, HCost, FCost, ParentId);
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

public class HeapSwap
{
    public int IndexA { get; set; }
    public int IndexB { get; set; }
    public string NodeA { get; set; } = string.Empty;
    public string NodeB { get; set; } = string.Empty;

    public HeapSwap() { }

    public HeapSwap(int indexA, int indexB, string nodeA, string nodeB)
    {
        IndexA = indexA;
        IndexB = indexB;
        NodeA = nodeA;
        NodeB = nodeB;
    }
}

public class TraceDelta
{
    public int Step { get; set; }
    public TraceAction Action { get; set; }
    public string? NodeId { get; set; }
    public CellState? BeforeState { get; set; }
    public CellState? AfterState { get; set; }
    public int FrontierSize { get; set; }
    public List<HeapSwap> HeapSwaps { get; set; } = new();
    public string? Details { get; set; }

    public TraceDelta() { }

    public TraceDelta(int step, TraceAction action, string? nodeId, CellState? beforeState, CellState? afterState, int frontierSize, List<HeapSwap>? heapSwaps = null, string? details = null)
    {
        Step = step;
        Action = action;
        NodeId = nodeId;
        BeforeState = beforeState;
        AfterState = afterState;
        FrontierSize = frontierSize;
        HeapSwaps = heapSwaps ?? new List<HeapSwap>();
        Details = details;
    }
}

public class Keyframe
{
    public int Step { get; set; }
    public Dictionary<string, CellState> CellStates { get; set; } = new();
    public List<string> Frontier { get; set; } = new();
    public string? ActiveNode { get; set; }
    public int ClosedCount { get; set; }

    public Keyframe() { }

    public Keyframe(int step, Dictionary<string, CellState> cellStates, List<string> frontier, string? activeNode, int closedCount)
    {
        Step = step;
        CellStates = cellStates;
        Frontier = frontier;
        ActiveNode = activeNode;
        ClosedCount = closedCount;
    }
}

public class ExecutionMetrics
{
    public int PathNodeCount { get; set; }
    public int PathEdgeCount { get; set; }
    public int? AlgorithmPathCost { get; set; }
    public int? TerrainPathCost { get; set; }
    public int NodesVisited { get; set; }
    public int MaxFrontierSize { get; set; }
    public double ExecutionTimeMs { get; set; }
    public int TotalSteps { get; set; }

    public ExecutionMetrics() { }

    public ExecutionMetrics(int pathNodeCount, int pathEdgeCount, int? algorithmPathCost, int? terrainPathCost, int nodesVisited, int maxFrontierSize, double executionTimeMs, int totalSteps)
    {
        PathNodeCount = pathNodeCount;
        PathEdgeCount = pathEdgeCount;
        AlgorithmPathCost = algorithmPathCost;
        TerrainPathCost = terrainPathCost;
        NodesVisited = nodesVisited;
        MaxFrontierSize = maxFrontierSize;
        ExecutionTimeMs = executionTimeMs;
        TotalSteps = totalSteps;
    }
}

public class PathfindingRequest
{
    public AlgorithmType Algorithm { get; set; }
    public GridModel Grid { get; set; } = new();
    public HeuristicType Heuristic { get; set; } = HeuristicType.MANHATTAN;

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
    public int PathNodeCount { get; set; }
    public int PathEdgeCount { get; set; }
    public int? AlgorithmPathCost { get; set; }
    public int? TerrainPathCost { get; set; }
    public List<TraceDelta> TraceDeltas { get; set; } = new();
    public List<Keyframe> Keyframes { get; set; } = new();
    public ExecutionMetrics Metrics { get; set; } = new();
    public bool Reversible { get; set; } = true;
    public string? NoPathReason { get; set; }
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
    public string EngineStatus { get; set; } = "UP";
    public string PersistenceStatus { get; set; } = "UP";
    public string Platform { get; set; } = ".NET 9.0 (C# 13)";
    public string Version { get; set; } = "2.1.0";
    public string PersistenceEngine { get; set; } = "IN_MEMORY";
    public bool DatabaseConnected { get; set; } = true;

    public HealthStatus() { }

    public HealthStatus(string status, string engineStatus, string persistenceStatus, string platform, string version, string persistenceEngine, bool databaseConnected)
    {
        Status = status;
        EngineStatus = engineStatus;
        PersistenceStatus = persistenceStatus;
        Platform = platform;
        Version = version;
        PersistenceEngine = persistenceEngine;
        DatabaseConnected = databaseConnected;
    }
}

public class ProbeStatus
{
    public string Status { get; set; } = "UP";

    public ProbeStatus() { }
    public ProbeStatus(string status) { Status = status; }
}

public class ProblemDetails
{
    public string Type { get; set; } = "https://aetheris.dev/errors/problem";
    public string Title { get; set; } = string.Empty;
    public int Status { get; set; }
    public string? Detail { get; set; }
    public string? Instance { get; set; }

    public ProblemDetails() { }

    public ProblemDetails(string type, string title, int status, string? detail, string? instance)
    {
        Type = type;
        Title = title;
        Status = status;
        Detail = detail;
        Instance = instance;
    }
}
