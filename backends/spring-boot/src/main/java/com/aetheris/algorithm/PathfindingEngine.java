package com.aetheris.algorithm;

import com.aetheris.domain.model.*;
import com.aetheris.frontier.FifoQueueFrontier;
import com.aetheris.frontier.IndexedMinHeapFrontier;
import com.aetheris.frontier.LifoStackFrontier;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class PathfindingEngine {

    private static final Direction[] DIRECTIONS = {
            Direction.UP,
            Direction.RIGHT,
            Direction.DOWN,
            Direction.LEFT
    };

    public PathfindingResponse execute(PathfindingRequest request) {
        long startTime = System.currentTimeMillis();

        AlgorithmType algorithm = request.getAlgorithm();
        GridModel grid = request.getGrid();
        int rows = grid.getRows();
        int cols = grid.getCols();
        String startNode = grid.getStartNode();
        String targetNode = grid.getTargetNode();

        int[] startPos = NodeIdUtil.parse(startNode);
        int[] targetPos = NodeIdUtil.parse(targetNode);

        Map<String, CellType> cellTypeMap = new HashMap<>();
        Map<String, Double> weightMap = new HashMap<>();

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                String id = NodeIdUtil.format(r, c);
                cellTypeMap.put(id, CellType.EMPTY);
                weightMap.put(id, 1.0);
            }
        }

        if (grid.getCells() != null) {
            for (CellDefinition cd : grid.getCells()) {
                cellTypeMap.put(cd.getId(), cd.getCellType());
                weightMap.put(cd.getId(), cd.getWeight());
            }
        }

        cellTypeMap.put(startNode, CellType.START);
        cellTypeMap.put(targetNode, CellType.TARGET);

        Map<String, CellState> stateMap = new HashMap<>();
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                String id = NodeIdUtil.format(r, c);
                stateMap.put(id, new CellState(cellTypeMap.get(id), TraversalState.UNVISITED, false, null, null, null));
            }
        }

        List<TraceDelta> traceDeltas = new ArrayList<>();
        int[] stepCounter = new int[]{0};

        java.util.function.BiConsumer<String, TraceAction> recordSimpleDelta = (nodeId, action) -> {
            CellState before = stateMap.get(nodeId).copy();
            CellState after = before.copy();
            traceDeltas.add(new TraceDelta(stepCounter[0]++, nodeId, action, before, after, 0));
        };

        boolean pathFound = false;
        List<String> path = new ArrayList<>();
        double pathCost = 0.0;
        int maxFrontierSize = 0;

        if (algorithm == AlgorithmType.BFS) {
            FifoQueueFrontier frontier = new FifoQueueFrontier();

            // Initial delta: ENQUEUE start
            CellState beforeStart = stateMap.get(startNode).copy();
            CellState afterStart = beforeStart.copy();
            afterStart.setTraversalState(TraversalState.IN_FRONTIER);
            afterStart.setGCost(0.0);
            afterStart.setFCost(0.0);
            stateMap.put(startNode, afterStart);

            frontier.push(startNode);
            maxFrontierSize = Math.max(maxFrontierSize, frontier.size());
            traceDeltas.add(new TraceDelta(stepCounter[0]++, startNode, TraceAction.ENQUEUE, beforeStart, afterStart.copy(), frontier.size()));

            while (!frontier.isEmpty()) {
                maxFrontierSize = Math.max(maxFrontierSize, frontier.size());
                String currId = frontier.pop();

                // DEQUEUE delta
                CellState bDeq = stateMap.get(currId).copy();
                traceDeltas.add(new TraceDelta(stepCounter[0]++, currId, TraceAction.DEQUEUE, bDeq, bDeq.copy(), frontier.size()));

                // VISIT delta
                CellState bVis = stateMap.get(currId).copy();
                CellState aVis = bVis.copy();
                aVis.setTraversalState(TraversalState.VISITED);
                stateMap.put(currId, aVis);
                traceDeltas.add(new TraceDelta(stepCounter[0]++, currId, TraceAction.VISIT, bVis, aVis.copy(), frontier.size()));

                if (currId.equals(targetNode)) {
                    pathFound = true;
                    break;
                }

                int[] currPos = NodeIdUtil.parse(currId);
                CellState currState = stateMap.get(currId);

                for (Direction dir : DIRECTIONS) {
                    int nr = currPos[0] + dir.dr;
                    int nc = currPos[1] + dir.dc;

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        String neighborId = NodeIdUtil.format(nr, nc);
                        CellType nType = cellTypeMap.get(neighborId);
                        CellState nState = stateMap.get(neighborId);

                        if (nType != CellType.WALL && nState.getTraversalState() == TraversalState.UNVISITED && !frontier.contains(neighborId)) {
                            // SET_PARENT
                            CellState bPar = stateMap.get(neighborId).copy();
                            CellState aPar = bPar.copy();
                            aPar.setParentId(currId);
                            aPar.setGCost(currState.getGCost() + 1.0);
                            stateMap.put(neighborId, aPar);
                            traceDeltas.add(new TraceDelta(stepCounter[0]++, neighborId, TraceAction.SET_PARENT, bPar, aPar.copy(), frontier.size()));

                            // ENQUEUE
                            frontier.push(neighborId);
                            maxFrontierSize = Math.max(maxFrontierSize, frontier.size());
                            CellState bEnq = stateMap.get(neighborId).copy();
                            CellState aEnq = bEnq.copy();
                            aEnq.setTraversalState(TraversalState.IN_FRONTIER);
                            stateMap.put(neighborId, aEnq);
                            traceDeltas.add(new TraceDelta(stepCounter[0]++, neighborId, TraceAction.ENQUEUE, bEnq, aEnq.copy(), frontier.size()));
                        }
                    }
                }
            }
        } else if (algorithm == AlgorithmType.DFS) {
            LifoStackFrontier frontier = new LifoStackFrontier();

            CellState beforeStart = stateMap.get(startNode).copy();
            CellState afterStart = beforeStart.copy();
            afterStart.setTraversalState(TraversalState.IN_FRONTIER);
            afterStart.setGCost(0.0);
            afterStart.setFCost(0.0);
            stateMap.put(startNode, afterStart);

            frontier.push(startNode);
            maxFrontierSize = Math.max(maxFrontierSize, frontier.size());
            traceDeltas.add(new TraceDelta(stepCounter[0]++, startNode, TraceAction.ENQUEUE, beforeStart, afterStart.copy(), frontier.size()));

            while (!frontier.isEmpty()) {
                maxFrontierSize = Math.max(maxFrontierSize, frontier.size());
                String currId = frontier.pop();

                CellState bDeq = stateMap.get(currId).copy();
                traceDeltas.add(new TraceDelta(stepCounter[0]++, currId, TraceAction.DEQUEUE, bDeq, bDeq.copy(), frontier.size()));

                CellState bVis = stateMap.get(currId).copy();
                CellState aVis = bVis.copy();
                aVis.setTraversalState(TraversalState.VISITED);
                stateMap.put(currId, aVis);
                traceDeltas.add(new TraceDelta(stepCounter[0]++, currId, TraceAction.VISIT, bVis, aVis.copy(), frontier.size()));

                if (currId.equals(targetNode)) {
                    pathFound = true;
                    break;
                }

                int[] currPos = NodeIdUtil.parse(currId);
                CellState currState = stateMap.get(currId);

                // Collect valid unvisited neighbors in normal order [UP, RIGHT, DOWN, LEFT]
                List<String> validNeighbors = new ArrayList<>();
                for (Direction dir : DIRECTIONS) {
                    int nr = currPos[0] + dir.dr;
                    int nc = currPos[1] + dir.dc;

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        String neighborId = NodeIdUtil.format(nr, nc);
                        CellType nType = cellTypeMap.get(neighborId);
                        CellState nState = stateMap.get(neighborId);

                        if (nType != CellType.WALL && nState.getTraversalState() == TraversalState.UNVISITED && !frontier.contains(neighborId)) {
                            validNeighbors.add(neighborId);
                        }
                    }
                }

                // Push in reverse order so the first neighbor is popped first
                for (int i = validNeighbors.size() - 1; i >= 0; i--) {
                    String nId = validNeighbors.get(i);

                    CellState bPar = stateMap.get(nId).copy();
                    CellState aPar = bPar.copy();
                    aPar.setParentId(currId);
                    aPar.setGCost(currState.getGCost() + 1.0);
                    stateMap.put(nId, aPar);
                    traceDeltas.add(new TraceDelta(stepCounter[0]++, nId, TraceAction.SET_PARENT, bPar, aPar.copy(), frontier.size()));

                    frontier.push(nId);
                    maxFrontierSize = Math.max(maxFrontierSize, frontier.size());
                    CellState bEnq = stateMap.get(nId).copy();
                    CellState aEnq = bEnq.copy();
                    aEnq.setTraversalState(TraversalState.IN_FRONTIER);
                    stateMap.put(nId, aEnq);
                    traceDeltas.add(new TraceDelta(stepCounter[0]++, nId, TraceAction.ENQUEUE, bEnq, aEnq.copy(), frontier.size()));
                }
            }
        } else if (algorithm == AlgorithmType.DIJKSTRA || algorithm == AlgorithmType.ASTAR) {
            boolean isAStar = (algorithm == AlgorithmType.ASTAR);
            IndexedMinHeapFrontier heap = new IndexedMinHeapFrontier(isAStar);
            long seqCounter = 0;

            double hStart = isAStar ? HeuristicCalculator.calculate(request.getHeuristic(), startPos[0], startPos[1], targetPos[0], targetPos[1]) : 0.0;
            IndexedMinHeapFrontier.HeapNode startNodeItem = new IndexedMinHeapFrontier.HeapNode(startNode, startPos[0], startPos[1], 0.0, hStart, hStart, seqCounter++);

            CellState beforeStart = stateMap.get(startNode).copy();
            CellState afterStart = beforeStart.copy();
            afterStart.setTraversalState(TraversalState.IN_FRONTIER);
            afterStart.setGCost(0.0);
            afterStart.setFCost(hStart);
            stateMap.put(startNode, afterStart);

            heap.push(startNodeItem);
            maxFrontierSize = Math.max(maxFrontierSize, heap.size());
            traceDeltas.add(new TraceDelta(stepCounter[0]++, startNode, TraceAction.ENQUEUE, beforeStart, afterStart.copy(), heap.size()));

            while (!heap.isEmpty()) {
                maxFrontierSize = Math.max(maxFrontierSize, heap.size());
                IndexedMinHeapFrontier.HeapNode top = heap.pop();

                CellState bDeq = stateMap.get(top.id).copy();
                traceDeltas.add(new TraceDelta(stepCounter[0]++, top.id, TraceAction.DEQUEUE, bDeq, bDeq.copy(), heap.size()));

                CellState bVis = stateMap.get(top.id).copy();
                CellState aVis = bVis.copy();
                aVis.setTraversalState(TraversalState.VISITED);
                stateMap.put(top.id, aVis);
                traceDeltas.add(new TraceDelta(stepCounter[0]++, top.id, TraceAction.VISIT, bVis, aVis.copy(), heap.size()));

                if (top.id.equals(targetNode)) {
                    pathFound = true;
                    break;
                }

                CellState currState = stateMap.get(top.id);

                for (Direction dir : DIRECTIONS) {
                    int nr = top.row + dir.dr;
                    int nc = top.col + dir.dc;

                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        String neighborId = NodeIdUtil.format(nr, nc);
                        CellType nType = cellTypeMap.get(neighborId);
                        CellState nState = stateMap.get(neighborId);

                        if (nType == CellType.WALL || nState.getTraversalState() == TraversalState.VISITED) {
                            continue;
                        }

                        double edgeWeight = weightMap.getOrDefault(neighborId, 1.0);
                        double tentativeGCost = currState.getGCost() + edgeWeight;
                        double h = isAStar ? HeuristicCalculator.calculate(request.getHeuristic(), nr, nc, targetPos[0], targetPos[1]) : 0.0;
                        double tentativeFCost = tentativeGCost + h;

                        if (nState.getTraversalState() == TraversalState.UNVISITED) {
                            CellState bPar = stateMap.get(neighborId).copy();
                            CellState aPar = bPar.copy();
                            aPar.setParentId(top.id);
                            aPar.setGCost(tentativeGCost);
                            aPar.setFCost(tentativeFCost);
                            stateMap.put(neighborId, aPar);
                            traceDeltas.add(new TraceDelta(stepCounter[0]++, neighborId, TraceAction.SET_PARENT, bPar, aPar.copy(), heap.size()));

                            IndexedMinHeapFrontier.HeapNode item = new IndexedMinHeapFrontier.HeapNode(neighborId, nr, nc, tentativeGCost, h, tentativeFCost, seqCounter++);
                            heap.push(item);
                            maxFrontierSize = Math.max(maxFrontierSize, heap.size());

                            CellState bEnq = stateMap.get(neighborId).copy();
                            CellState aEnq = bEnq.copy();
                            aEnq.setTraversalState(TraversalState.IN_FRONTIER);
                            stateMap.put(neighborId, aEnq);
                            traceDeltas.add(new TraceDelta(stepCounter[0]++, neighborId, TraceAction.ENQUEUE, bEnq, aEnq.copy(), heap.size()));
                        } else if (nState.getTraversalState() == TraversalState.IN_FRONTIER && tentativeGCost < nState.getGCost()) {
                            CellState bUpd = stateMap.get(neighborId).copy();
                            CellState aUpd = bUpd.copy();
                            aUpd.setParentId(top.id);
                            aUpd.setGCost(tentativeGCost);
                            aUpd.setFCost(tentativeFCost);
                            stateMap.put(neighborId, aUpd);
                            traceDeltas.add(new TraceDelta(stepCounter[0]++, neighborId, TraceAction.UPDATE_COST, bUpd, aUpd.copy(), heap.size()));

                            heap.update(neighborId, tentativeGCost, tentativeFCost);
                        }
                    }
                }
            }
        }

        if (pathFound) {
            String curr = targetNode;
            List<String> rev = new ArrayList<>();
            while (curr != null) {
                rev.add(curr);
                curr = stateMap.get(curr).getParentId();
            }
            Collections.reverse(rev);
            path = rev;
            pathCost = stateMap.get(targetNode).getGCost();

            for (String pId : path) {
                CellState bMark = stateMap.get(pId).copy();
                CellState aMark = bMark.copy();
                aMark.setInPath(true);
                stateMap.put(pId, aMark);
                traceDeltas.add(new TraceDelta(stepCounter[0]++, pId, TraceAction.MARK_PATH, bMark, aMark.copy(), 0));
            }
        }

        long executionTimeMs = Math.max(1, System.currentTimeMillis() - startTime);
        long visitedCount = stateMap.values().stream().filter(s -> s.getTraversalState() == TraversalState.VISITED).count();

        ExecutionMetrics metrics = new ExecutionMetrics((int) visitedCount, maxFrontierSize, (double) executionTimeMs, path.size(), pathCost);

        PathfindingResponse response = new PathfindingResponse();
        response.setAlgorithm(algorithm);
        response.setPathFound(pathFound);
        response.setPath(path);
        response.setPathCost(pathCost);
        response.setTraceDeltas(traceDeltas);
        response.setMetrics(metrics);
        response.setReversible(true);

        return response;
    }
}
