using Aetheris.Core.Algorithm;
using Aetheris.Core.Domain;
using Aetheris.Core.Validation;

namespace Aetheris.Application;

public class PathfindingApplicationService
{
    private readonly PathfindingEngine _engine;

    public PathfindingApplicationService(PathfindingEngine engine)
    {
        _engine = engine;
    }

    public PathfindingResponse ExecuteTrace(PathfindingRequest? request)
    {
        GridValidator.ValidatePathfindingRequest(request);
        return _engine.Execute(request!);
    }

    public IReadOnlyList<AlgorithmInfo> ListAlgorithms() => new List<AlgorithmInfo>
    {
        new(AlgorithmType.BFS, "Breadth-First Search (BFS)", "Explores nodes level by level using a FIFO queue. Guarantees shortest path on unweighted graphs.", false, true, "FIFO_QUEUE"),
        new(AlgorithmType.DFS, "Depth-First Search (DFS)", "Explores along branches to maximum depth using a LIFO stack. Does not guarantee shortest path.", false, false, "LIFO_STACK"),
        new(AlgorithmType.DIJKSTRA, "Dijkstra's Algorithm", "Finds optimal path using deterministic indexed min-heap. Guarantees shortest path with positive integer weights.", true, true, "INDEXED_MIN_HEAP"),
        new(AlgorithmType.ASTAR, "A* Heuristic Search", "Directed search combining actual cost g(n) and integer Manhattan heuristic h(n) via deterministic indexed min-heap.", true, true, "INDEXED_MIN_HEAP")
    };

    public bool IsEngineReady() => _engine != null;
}
