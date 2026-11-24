using System.Diagnostics;
using Aetheris.Core.Domain;
using Aetheris.Core.Frontier;

namespace Aetheris.Core.Algorithm;

public class PathfindingEngine
{
    public PathfindingResponse Execute(PathfindingRequest request)
    {
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
        var weightMap = new Dictionary<string, double>();

        for (int r = 0; r < rows; r++)
        {
            for (int c = 0; c < cols; c++)
            {
                string id = NodeIdUtil.Format(r, c);
                cellTypeMap[id] = CellType.EMPTY;
                weightMap[id] = 1.0;
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

        cellTypeMap[startNode] = CellType.START;
        cellTypeMap[targetNode] = CellType.TARGET;

        var stateMap = new Dictionary<string, CellState>();
        for (int r = 0; r < rows; r++)
        {
            for (int c = 0; c < cols; c++)
            {
                string id = NodeIdUtil.Format(r, c);
                stateMap[id] = new CellState(cellTypeMap[id], TraversalState.UNVISITED, false, null, null, null);
            }
        }

        var traceDeltas = new List<TraceDelta>();
        int stepCounter = 0;

        bool pathFound = false;
        var path = new List<string>();
        double pathCost = 0.0;
        int maxFrontierSize = 0;

        if (algorithm == AlgorithmType.BFS)
        {
            var frontier = new FifoQueueFrontier();

            var beforeStart = stateMap[startNode].Copy();
            var afterStart = beforeStart.Copy();
            afterStart.TraversalState = TraversalState.IN_FRONTIER;
            afterStart.GCost = 0.0;
            afterStart.FCost = 0.0;
            stateMap[startNode] = afterStart;

            frontier.Push(startNode);
            maxFrontierSize = Math.Max(maxFrontierSize, frontier.Count);
            traceDeltas.Add(new TraceDelta(stepCounter++, startNode, TraceAction.ENQUEUE, beforeStart, afterStart.Copy(), frontier.Count));

            while (!frontier.IsEmpty)
            {
                maxFrontierSize = Math.Max(maxFrontierSize, frontier.Count);
                string currId = frontier.Pop();

                var bDeq = stateMap[currId].Copy();
                traceDeltas.Add(new TraceDelta(stepCounter++, currId, TraceAction.DEQUEUE, bDeq, bDeq.Copy(), frontier.Count));

                var bVis = stateMap[currId].Copy();
                var aVis = bVis.Copy();
                aVis.TraversalState = TraversalState.VISITED;
                stateMap[currId] = aVis;
                traceDeltas.Add(new TraceDelta(stepCounter++, currId, TraceAction.VISIT, bVis, aVis.Copy(), frontier.Count));

                if (currId == targetNode)
                {
                    pathFound = true;
                    break;
                }

                var (currR, currC) = NodeIdUtil.Parse(currId);
                var currState = stateMap[currId];

                foreach (var dir in Direction.All)
                {
                    int nr = currR + dir.Dr;
                    int nc = currC + dir.Dc;

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols)
                    {
                        string neighborId = NodeIdUtil.Format(nr, nc);
                        var nType = cellTypeMap[neighborId];
                        var nState = stateMap[neighborId];

                        if (nType != CellType.WALL && nState.TraversalState == TraversalState.UNVISITED && !frontier.Contains(neighborId))
                        {
                            var bPar = stateMap[neighborId].Copy();
                            var aPar = bPar.Copy();
                            aPar.ParentId = currId;
                            aPar.GCost = currState.GCost + 1.0;
                            stateMap[neighborId] = aPar;
                            traceDeltas.Add(new TraceDelta(stepCounter++, neighborId, TraceAction.SET_PARENT, bPar, aPar.Copy(), frontier.Count));

                            frontier.Push(neighborId);
                            maxFrontierSize = Math.Max(maxFrontierSize, frontier.Count);
                            var bEnq = stateMap[neighborId].Copy();
                            var aEnq = bEnq.Copy();
                            aEnq.TraversalState = TraversalState.IN_FRONTIER;
                            stateMap[neighborId] = aEnq;
                            traceDeltas.Add(new TraceDelta(stepCounter++, neighborId, TraceAction.ENQUEUE, bEnq, aEnq.Copy(), frontier.Count));
                        }
                    }
                }
            }
        }
        else if (algorithm == AlgorithmType.DFS)
        {
            var frontier = new LifoStackFrontier();

            var beforeStart = stateMap[startNode].Copy();
            var afterStart = beforeStart.Copy();
            afterStart.TraversalState = TraversalState.IN_FRONTIER;
            afterStart.GCost = 0.0;
            afterStart.FCost = 0.0;
            stateMap[startNode] = afterStart;

            frontier.Push(startNode);
            maxFrontierSize = Math.Max(maxFrontierSize, frontier.Count);
            traceDeltas.Add(new TraceDelta(stepCounter++, startNode, TraceAction.ENQUEUE, beforeStart, afterStart.Copy(), frontier.Count));

            while (!frontier.IsEmpty)
            {
                maxFrontierSize = Math.Max(maxFrontierSize, frontier.Count);
                string currId = frontier.Pop();

                var bDeq = stateMap[currId].Copy();
                traceDeltas.Add(new TraceDelta(stepCounter++, currId, TraceAction.DEQUEUE, bDeq, bDeq.Copy(), frontier.Count));

                var bVis = stateMap[currId].Copy();
                var aVis = bVis.Copy();
                aVis.TraversalState = TraversalState.VISITED;
                stateMap[currId] = aVis;
                traceDeltas.Add(new TraceDelta(stepCounter++, currId, TraceAction.VISIT, bVis, aVis.Copy(), frontier.Count));

                if (currId == targetNode)
                {
                    pathFound = true;
                    break;
                }

                var (currR, currC) = NodeIdUtil.Parse(currId);
                var currState = stateMap[currId];

                var validNeighbors = new List<string>();
                foreach (var dir in Direction.All)
                {
                    int nr = currR + dir.Dr;
                    int nc = currC + dir.Dc;

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols)
                    {
                        string neighborId = NodeIdUtil.Format(nr, nc);
                        var nType = cellTypeMap[neighborId];
                        var nState = stateMap[neighborId];

                        if (nType != CellType.WALL && nState.TraversalState == TraversalState.UNVISITED && !frontier.Contains(neighborId))
                        {
                            validNeighbors.Add(neighborId);
                        }
                    }
                }

                // Push in reverse order so UP is popped first
                for (int i = validNeighbors.Count - 1; i >= 0; i--)
                {
                    string nId = validNeighbors[i];

                    var bPar = stateMap[nId].Copy();
                    var aPar = bPar.Copy();
                    aPar.ParentId = currId;
                    aPar.GCost = currState.GCost + 1.0;
                    stateMap[nId] = aPar;
                    traceDeltas.Add(new TraceDelta(stepCounter++, nId, TraceAction.SET_PARENT, bPar, aPar.Copy(), frontier.Count));

                    frontier.Push(nId);
                    maxFrontierSize = Math.Max(maxFrontierSize, frontier.Count);
                    var bEnq = stateMap[nId].Copy();
                    var aEnq = bEnq.Copy();
                    aEnq.TraversalState = TraversalState.IN_FRONTIER;
                    stateMap[nId] = aEnq;
                    traceDeltas.Add(new TraceDelta(stepCounter++, nId, TraceAction.ENQUEUE, bEnq, aEnq.Copy(), frontier.Count));
                }
            }
        }
        else if (algorithm == AlgorithmType.DIJKSTRA || algorithm == AlgorithmType.ASTAR)
        {
            bool isAStar = (algorithm == AlgorithmType.ASTAR);
            var heap = new IndexedMinHeapFrontier(isAStar);
            long seqCounter = 0;

            double hStart = isAStar ? HeuristicCalculator.Calculate(request.Heuristic, startR, startC, targetR, targetC) : 0.0;
            var startNodeItem = new IndexedMinHeapFrontier.HeapNode(startNode, startR, startC, 0.0, hStart, hStart, seqCounter++);

            var beforeStart = stateMap[startNode].Copy();
            var afterStart = beforeStart.Copy();
            afterStart.TraversalState = TraversalState.IN_FRONTIER;
            afterStart.GCost = 0.0;
            afterStart.FCost = hStart;
            stateMap[startNode] = afterStart;

            heap.Push(startNodeItem);
            maxFrontierSize = Math.Max(maxFrontierSize, heap.Count);
            traceDeltas.Add(new TraceDelta(stepCounter++, startNode, TraceAction.ENQUEUE, beforeStart, afterStart.Copy(), heap.Count));

            while (!heap.IsEmpty)
            {
                maxFrontierSize = Math.Max(maxFrontierSize, heap.Count);
                var top = heap.Pop();

                var bDeq = stateMap[top.Id].Copy();
                traceDeltas.Add(new TraceDelta(stepCounter++, top.Id, TraceAction.DEQUEUE, bDeq, bDeq.Copy(), heap.Count));

                var bVis = stateMap[top.Id].Copy();
                var aVis = bVis.Copy();
                aVis.TraversalState = TraversalState.VISITED;
                stateMap[top.Id] = aVis;
                traceDeltas.Add(new TraceDelta(stepCounter++, top.Id, TraceAction.VISIT, bVis, aVis.Copy(), heap.Count));

                if (top.Id == targetNode)
                {
                    pathFound = true;
                    break;
                }

                var currState = stateMap[top.Id];

                foreach (var dir in Direction.All)
                {
                    int nr = top.Row + dir.Dr;
                    int nc = top.Col + dir.Dc;

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols)
                    {
                        string neighborId = NodeIdUtil.Format(nr, nc);
                        var nType = cellTypeMap[neighborId];
                        var nState = stateMap[neighborId];

                        if (nType == CellType.WALL || nState.TraversalState == TraversalState.VISITED)
                        {
                            continue;
                        }

                        double edgeWeight = weightMap.TryGetValue(neighborId, out double w) ? w : 1.0;
                        double tentativeGCost = currState.GCost!.Value + edgeWeight;
                        double h = isAStar ? HeuristicCalculator.Calculate(request.Heuristic, nr, nc, targetR, targetC) : 0.0;
                        double tentativeFCost = tentativeGCost + h;

                        if (nState.TraversalState == TraversalState.UNVISITED)
                        {
                            var bPar = stateMap[neighborId].Copy();
                            var aPar = bPar.Copy();
                            aPar.ParentId = top.Id;
                            aPar.GCost = tentativeGCost;
                            aPar.FCost = tentativeFCost;
                            stateMap[neighborId] = aPar;
                            traceDeltas.Add(new TraceDelta(stepCounter++, neighborId, TraceAction.SET_PARENT, bPar, aPar.Copy(), heap.Count));

                            var item = new IndexedMinHeapFrontier.HeapNode(neighborId, nr, nc, tentativeGCost, h, tentativeFCost, seqCounter++);
                            heap.Push(item);
                            maxFrontierSize = Math.Max(maxFrontierSize, heap.Count);

                            var bEnq = stateMap[neighborId].Copy();
                            var aEnq = bEnq.Copy();
                            aEnq.TraversalState = TraversalState.IN_FRONTIER;
                            stateMap[neighborId] = aEnq;
                            traceDeltas.Add(new TraceDelta(stepCounter++, neighborId, TraceAction.ENQUEUE, bEnq, aEnq.Copy(), heap.Count));
                        }
                        else if (nState.TraversalState == TraversalState.IN_FRONTIER && tentativeGCost < nState.GCost!.Value)
                        {
                            var bUpd = stateMap[neighborId].Copy();
                            var aUpd = bUpd.Copy();
                            aUpd.ParentId = top.Id;
                            aUpd.GCost = tentativeGCost;
                            aUpd.FCost = tentativeFCost;
                            stateMap[neighborId] = aUpd;
                            traceDeltas.Add(new TraceDelta(stepCounter++, neighborId, TraceAction.UPDATE_COST, bUpd, aUpd.Copy(), heap.Count));

                            heap.Update(neighborId, tentativeGCost, tentativeFCost);
                        }
                    }
                }
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
            pathCost = stateMap[targetNode].GCost!.Value;

            foreach (var pId in path)
            {
                var bMark = stateMap[pId].Copy();
                var aMark = bMark.Copy();
                aMark.InPath = true;
                stateMap[pId] = aMark;
                traceDeltas.Add(new TraceDelta(stepCounter++, pId, TraceAction.MARK_PATH, bMark, aMark.Copy(), 0));
            }
        }

        stopwatch.Stop();
        double executionTimeMs = Math.Max(0.01, stopwatch.Elapsed.TotalMilliseconds);
        int visitedCount = stateMap.Values.Count(s => s.TraversalState == TraversalState.VISITED);

        var metrics = new ExecutionMetrics(visitedCount, maxFrontierSize, executionTimeMs, path.Count, pathCost);

        return new PathfindingResponse
        {
            Algorithm = algorithm,
            PathFound = pathFound,
            Path = path,
            PathCost = pathCost,
            TraceDeltas = traceDeltas,
            Metrics = metrics,
            Reversible = true
        };
    }
}
