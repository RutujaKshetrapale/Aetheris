using System.Diagnostics;
using Aetheris.Core.Domain;
using Aetheris.Core.Frontier;
using Aetheris.Core.Validation;

namespace Aetheris.Core.Algorithm;

public class PathfindingEngine
{
    private static readonly Direction[] Directions =
    {
        Direction.UP,
        Direction.RIGHT,
        Direction.DOWN,
        Direction.LEFT
    };

    private static readonly Direction[] ReverseDirections =
    {
        Direction.LEFT,
        Direction.DOWN,
        Direction.RIGHT,
        Direction.UP
    };

    public void Validate(PathfindingRequest? request)
    {
        try
        {
            GridValidator.ValidatePathfindingRequest(request);
        }
        catch (ArgumentException ex) when (ex.GetType() != typeof(ArgumentException))
        {
            throw new ArgumentException(ex.Message, ex);
        }
    }

    public PathfindingResponse Execute(PathfindingRequest request)
    {
        Validate(request);
        var stopwatch = Stopwatch.StartNew();

        var algorithm = request.Algorithm;
        var grid = request.Grid;
        int rows = grid.Rows;
        int cols = grid.Cols;
        string startNode = grid.StartNode;
        string targetNode = grid.TargetNode;

        var (startR, startC) = NodeIdUtil.Parse(startNode);
        var (targetR, targetC) = NodeIdUtil.Parse(targetNode);

        var cellTypeMap = new Dictionary<string, CellType>();
        var weightMap = new Dictionary<string, int>();

        for (int r = 0; r < rows; r++)
        {
            for (int c = 0; c < cols; c++)
            {
                string id = NodeIdUtil.Format(r, c);
                cellTypeMap[id] = CellType.EMPTY;
                weightMap[id] = 1;
            }
        }

        if (grid.Cells != null)
        {
            foreach (var cd in grid.Cells)
            {
                cellTypeMap[cd.Id] = cd.CellType;
                weightMap[cd.Id] = cd.Weight;
            }
        }

        cellTypeMap[targetNode] = CellType.TARGET;
        cellTypeMap[startNode] = CellType.START;
        weightMap[startNode] = 0; // START contributes zero entry cost

        var stateMap = new Dictionary<string, CellState>();
        for (int r = 0; r < rows; r++)
        {
            for (int c = 0; c < cols; c++)
            {
                string id = NodeIdUtil.Format(r, c);
                stateMap[id] = new CellState(cellTypeMap[id], TraversalState.UNVISITED, false, null, null, null, null);
            }
        }

        var traceDeltas = new List<TraceDelta>();
        var keyframes = new List<Keyframe>();
        int stepCounter = 0;
        int maxFrontierSize = 0;
        int visitedCount = 0;
        var closedSet = new HashSet<string>();
        string? activeNode = null;
        Func<List<string>> getFrontierIds = () => new List<string>();

        void CaptureKeyframe(int frontierSize)
        {
            int stepNum = stepCounter - 1;
            var snapshot = new Dictionary<string, CellState>(stateMap.Count);
            foreach (var kvp in stateMap)
            {
                snapshot[kvp.Key] = kvp.Value.Copy();
            }
            keyframes.Add(new Keyframe(
                stepNum,
                snapshot,
                getFrontierIds(),
                activeNode,
                closedSet.Count
            ));
        }

        TraceDelta RecordDelta(TraceAction action, string? nodeId, int frontierSize,
            TraversalState? traversalState = null, bool? inPath = null,
            int? gCost = null, int? hCost = null, int? fCost = null,
            string? parentId = null, bool setParent = false,
            List<HeapSwap>? heapSwaps = null, string? details = null,
            string? operationSubtype = null)
        {
            CellState? before = null;
            CellState? after = null;

            if (nodeId != null && stateMap.TryGetValue(nodeId, out var current))
            {
                before = current.Copy();
                after = before.Copy();
                if (traversalState.HasValue) after.TraversalState = traversalState.Value;
                if (inPath.HasValue) after.InPath = inPath.Value;
                if (gCost.HasValue) after.GCost = gCost.Value;
                if (hCost.HasValue) after.HCost = hCost.Value;
                if (fCost.HasValue) after.FCost = fCost.Value;
                if (setParent) after.ParentId = parentId;

                stateMap[nodeId] = after;
            }

            var delta = new TraceDelta(
                stepCounter++,
                action,
                nodeId,
                before,
                after,
                frontierSize,
                heapSwaps,
                details,
                operationSubtype
            );
            traceDeltas.Add(delta);

            if (delta.Step % 50 == 0)
            {
                CaptureKeyframe(frontierSize);
            }

            return delta;
        }

        bool pathFound = false;
        var path = new List<string>();
        int pathNodeCount = 0;
        int pathEdgeCount = 0;
        int? algorithmPathCost = null;
        int? terrainPathCost = null;

        // Special Case: Start equals target
        if (startNode == targetNode)
        {
            RecordDelta(TraceAction.INITIALIZE, startNode, 0,
                traversalState: TraversalState.ACTIVE,
                gCost: 0, hCost: 0, fCost: 0, parentId: null, setParent: true,
                details: "Start equals target initialization");

            RecordDelta(TraceAction.PATH_FOUND, startNode, 0,
                inPath: true, traversalState: TraversalState.CLOSED,
                details: "Target is start node");

            path = new List<string> { startNode };
            pathNodeCount = 1;
            pathEdgeCount = 0;
            algorithmPathCost = 0;
            terrainPathCost = 0;
            visitedCount = 1;

            stopwatch.Stop();
            double executionTimeMs = Math.Max(0.01, stopwatch.Elapsed.TotalMilliseconds);

            return new PathfindingResponse
            {
                Algorithm = algorithm,
                PathFound = true,
                Path = path,
                PathNodeCount = 1,
                PathEdgeCount = 0,
                AlgorithmPathCost = 0,
                TerrainPathCost = 0,
                TraceDeltas = traceDeltas,
                Keyframes = keyframes,
                Metrics = new ExecutionMetrics(1, 0, 0, 0, 1, 0, executionTimeMs, traceDeltas.Count),
                Reversible = true,
                NoPathReason = null
            };
        }

        // Normal Execution
        if (algorithm == AlgorithmType.BFS)
        {
            var queue = new FifoQueueFrontier();
            getFrontierIds = queue.GetFrontierIds;

            RecordDelta(TraceAction.INITIALIZE, startNode, 1,
                traversalState: TraversalState.FRONTIER,
                gCost: 0, hCost: 0, fCost: 0, parentId: null, setParent: true,
                details: "Initialize start node in BFS queue");

            queue.Push(startNode);
            maxFrontierSize = Math.Max(maxFrontierSize, queue.Count);

            while (!queue.IsEmpty)
            {
                maxFrontierSize = Math.Max(maxFrontierSize, queue.Count);
                string currId = queue.Pop();

                RecordDelta(TraceAction.DEQUEUE_FRONTIER, currId, queue.Count);

                activeNode = currId;
                RecordDelta(TraceAction.EXAMINE_NODE, currId, queue.Count, traversalState: TraversalState.ACTIVE);
                visitedCount++;

                if (currId == targetNode)
                {
                    pathFound = true;
                    closedSet.Add(currId);
                    RecordDelta(TraceAction.CLOSE_NODE, currId, queue.Count, traversalState: TraversalState.CLOSED);
                    activeNode = null;
                    break;
                }

                var (currR, currC) = NodeIdUtil.Parse(currId);
                int currGCost = stateMap[currId].GCost!.Value;

                foreach (var dir in Directions)
                {
                    int nr = currR + dir.Dr;
                    int nc = currC + dir.Dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

                    string nId = NodeIdUtil.Format(nr, nc);
                    if (cellTypeMap[nId] == CellType.WALL) continue;
                    if (queue.Contains(nId) || closedSet.Contains(nId)) continue;

                    int newGCost = currGCost + 1;
                    queue.Push(nId);
                    maxFrontierSize = Math.Max(maxFrontierSize, queue.Count);

                    RecordDelta(TraceAction.ENQUEUE_FRONTIER, nId, queue.Count,
                        traversalState: TraversalState.FRONTIER,
                        gCost: newGCost, fCost: newGCost, parentId: currId, setParent: true);
                }

                closedSet.Add(currId);
                RecordDelta(TraceAction.CLOSE_NODE, currId, queue.Count, traversalState: TraversalState.CLOSED);
                activeNode = null;
            }
        }
        else if (algorithm == AlgorithmType.DFS)
        {
            var stack = new LifoStackFrontier();
            getFrontierIds = stack.GetFrontierIds;

            RecordDelta(TraceAction.INITIALIZE, startNode, 1,
                traversalState: TraversalState.FRONTIER,
                gCost: 0, hCost: 0, fCost: 0, parentId: null, setParent: true,
                details: "Initialize start node in DFS stack");

            stack.Push(startNode);
            maxFrontierSize = Math.Max(maxFrontierSize, stack.Count);

            while (!stack.IsEmpty)
            {
                maxFrontierSize = Math.Max(maxFrontierSize, stack.Count);
                string currId = stack.Pop();

                RecordDelta(TraceAction.DEQUEUE_FRONTIER, currId, stack.Count);

                activeNode = currId;
                RecordDelta(TraceAction.EXAMINE_NODE, currId, stack.Count, traversalState: TraversalState.ACTIVE);
                visitedCount++;

                if (currId == targetNode)
                {
                    pathFound = true;
                    closedSet.Add(currId);
                    RecordDelta(TraceAction.CLOSE_NODE, currId, stack.Count, traversalState: TraversalState.CLOSED);
                    activeNode = null;
                    break;
                }

                var (currR, currC) = NodeIdUtil.Parse(currId);
                int currGCost = stateMap[currId].GCost!.Value;

                // Push in reverse order (LEFT, DOWN, RIGHT, UP) so pop order is UP, RIGHT, DOWN, LEFT
                foreach (var dir in ReverseDirections)
                {
                    int nr = currR + dir.Dr;
                    int nc = currC + dir.Dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

                    string nId = NodeIdUtil.Format(nr, nc);
                    if (cellTypeMap[nId] == CellType.WALL) continue;
                    if (stack.Contains(nId) || closedSet.Contains(nId)) continue;

                    int newGCost = currGCost + 1;
                    stack.Push(nId);
                    maxFrontierSize = Math.Max(maxFrontierSize, stack.Count);

                    RecordDelta(TraceAction.ENQUEUE_FRONTIER, nId, stack.Count,
                        traversalState: TraversalState.FRONTIER,
                        gCost: newGCost, fCost: newGCost, parentId: currId, setParent: true);
                }

                closedSet.Add(currId);
                RecordDelta(TraceAction.CLOSE_NODE, currId, stack.Count, traversalState: TraversalState.CLOSED);
                activeNode = null;
            }
        }
        else if (algorithm == AlgorithmType.DIJKSTRA || algorithm == AlgorithmType.ASTAR)
        {
            bool isAStar = (algorithm == AlgorithmType.ASTAR);
            int minTraversableWeight = int.MaxValue;
            foreach (var kvp in weightMap)
            {
                if (kvp.Key != startNode && cellTypeMap[kvp.Key] != CellType.WALL)
                {
                    minTraversableWeight = Math.Min(minTraversableWeight, kvp.Value);
                }
            }
            if (minTraversableWeight == int.MaxValue || minTraversableWeight < 1)
            {
                minTraversableWeight = 1;
            }

            var heap = new IndexedMinHeapFrontier(isAStar);
            getFrontierIds = heap.GetFrontierIds;
            long enqueueSeq = 0;

            int startH = isAStar ? HeuristicCalculator.Calculate(request.Heuristic, startR, startC, targetR, targetC, minTraversableWeight) : 0;
            int startF = startH;

            heap.Push(new IndexedMinHeapFrontier.HeapNode(startNode, startR, startC, 0, startH, startF, enqueueSeq++));
            heap.DrainSwaps();
            maxFrontierSize = Math.Max(maxFrontierSize, heap.Count);

            RecordDelta(TraceAction.INITIALIZE, startNode, 1,
                traversalState: TraversalState.FRONTIER,
                gCost: 0, hCost: startH, fCost: startF, parentId: null, setParent: true,
                details: "Initialize start node in indexed min-heap");

            while (!heap.IsEmpty)
            {
                maxFrontierSize = Math.Max(maxFrontierSize, heap.Count);
                var top = heap.Pop();
                var popSwaps = heap.DrainSwaps();

                RecordDelta(TraceAction.DEQUEUE_FRONTIER, top.Id, heap.Count, heapSwaps: popSwaps);

                activeNode = top.Id;
                RecordDelta(TraceAction.EXAMINE_NODE, top.Id, heap.Count, traversalState: TraversalState.ACTIVE);
                visitedCount++;

                if (top.Id == targetNode)
                {
                    pathFound = true;
                    closedSet.Add(top.Id);
                    RecordDelta(TraceAction.CLOSE_NODE, top.Id, heap.Count, traversalState: TraversalState.CLOSED);
                    activeNode = null;
                    break;
                }

                int currGCost = top.GCost;

                foreach (var dir in Directions)
                {
                    int nr = top.Row + dir.Dr;
                    int nc = top.Col + dir.Dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

                    string nId = NodeIdUtil.Format(nr, nc);
                    if (cellTypeMap[nId] == CellType.WALL) continue;
                    if (closedSet.Contains(nId)) continue;

                    int entryCost = weightMap[nId];
                    int newGCost = currGCost + entryCost;
                    int hCost = isAStar ? HeuristicCalculator.Calculate(request.Heuristic, nr, nc, targetR, targetC, minTraversableWeight) : 0;
                    int newFCost = newGCost + hCost;

                    if (heap.Contains(nId))
                    {
                        var currNeigh = stateMap[nId];
                        if (newGCost < currNeigh.GCost!.Value)
                        {
                            heap.DecreaseKey(nId, newGCost, newFCost);
                            var decSwaps = heap.DrainSwaps();

                            RecordDelta(TraceAction.ENQUEUE_FRONTIER, nId, heap.Count,
                                gCost: newGCost, fCost: newFCost, parentId: top.Id, setParent: true,
                                heapSwaps: decSwaps, details: $"DECREASE_KEY: Relaxation via {top.Id}",
                                operationSubtype: "DECREASE_KEY");
                        }
                    }
                    else
                    {
                        heap.Push(new IndexedMinHeapFrontier.HeapNode(nId, nr, nc, newGCost, hCost, newFCost, enqueueSeq++));
                        var pushSwaps = heap.DrainSwaps();

                        RecordDelta(TraceAction.ENQUEUE_FRONTIER, nId, heap.Count,
                            traversalState: TraversalState.FRONTIER,
                            gCost: newGCost, hCost: hCost, fCost: newFCost, parentId: top.Id, setParent: true,
                            heapSwaps: pushSwaps);

                        maxFrontierSize = Math.Max(maxFrontierSize, heap.Count);
                    }
                }

                closedSet.Add(top.Id);
                RecordDelta(TraceAction.CLOSE_NODE, top.Id, heap.Count, traversalState: TraversalState.CLOSED);
                activeNode = null;
            }
        }

        if (pathFound)
        {
            string? curr = targetNode;
            var rev = new List<string>();
            while (curr != null)
            {
                rev.Add(curr);
                curr = stateMap[curr].ParentId;
            }
            rev.Reverse();
            path = rev;
            pathNodeCount = path.Count;
            pathEdgeCount = Math.Max(0, path.Count - 1);

            int terrainCost = 0;
            for (int i = 1; i < path.Count; i++)
            {
                terrainCost += weightMap[path[i]];
            }
            terrainPathCost = terrainCost;

            if (algorithm == AlgorithmType.BFS || algorithm == AlgorithmType.DFS)
            {
                algorithmPathCost = pathEdgeCount;
            }
            else
            {
                algorithmPathCost = terrainCost;
            }

            foreach (var pId in path)
            {
                RecordDelta(TraceAction.PATH_FOUND, pId, 0, inPath: true);
            }
        }
        else
        {
            path = new List<string>();
            pathNodeCount = 0;
            pathEdgeCount = 0;
            algorithmPathCost = null;
            terrainPathCost = null;

            RecordDelta(TraceAction.NO_PATH_FOUND, null, 0, details: "FRONTIER_EXHAUSTED");
        }

        stopwatch.Stop();
        double totalExecutionTimeMs = Math.Max(0.01, stopwatch.Elapsed.TotalMilliseconds);

        var metrics = new ExecutionMetrics(
            pathNodeCount,
            pathEdgeCount,
            algorithmPathCost,
            terrainPathCost,
            visitedCount,
            maxFrontierSize,
            totalExecutionTimeMs,
            traceDeltas.Count
        );

        return new PathfindingResponse
        {
            Algorithm = algorithm,
            PathFound = pathFound,
            Path = path,
            PathNodeCount = pathNodeCount,
            PathEdgeCount = pathEdgeCount,
            AlgorithmPathCost = algorithmPathCost,
            TerrainPathCost = terrainPathCost,
            TraceDeltas = traceDeltas,
            Keyframes = keyframes,
            Metrics = metrics,
            Reversible = true,
            NoPathReason = pathFound ? null : "FRONTIER_EXHAUSTED"
        };
    }
}
