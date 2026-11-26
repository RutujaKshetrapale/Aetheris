package com.aetheris.algorithm;

import com.aetheris.domain.model.*;
import com.aetheris.frontier.FifoQueueFrontier;
import com.aetheris.frontier.IndexedMinHeapFrontier;
import com.aetheris.frontier.LifoStackFrontier;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.function.Consumer;
import java.util.function.Supplier;

@Service
public class PathfindingEngine {

    private static final Direction[] DIRECTIONS = {
            Direction.UP,
            Direction.RIGHT,
            Direction.DOWN,
            Direction.LEFT
    };

    private static final Direction[] REVERSE_DIRECTIONS = {
            Direction.LEFT,
            Direction.DOWN,
            Direction.RIGHT,
            Direction.UP
    };

    public PathfindingResponse execute(PathfindingRequest request) {
        long startTime = System.currentTimeMillis();

        AlgorithmType algorithm = request.getAlgorithm();
        GridModel grid = request.getGrid();
        int rows = grid.getRows();
        int cols = grid.getCols();
        String startNode = grid.getStartNode();
        String targetNode = grid.getTargetNode();

        Map<String, CellType> cellTypeMap = new HashMap<>();
        Map<String, Integer> weightMap = new HashMap<>();

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                String id = NodeIdUtil.format(r, c);
                cellTypeMap.put(id, CellType.EMPTY);
                weightMap.put(id, 1);
            }
        }

        if (grid.getCells() != null) {
            for (CellDefinition cd : grid.getCells()) {
                cellTypeMap.put(cd.getId(), cd.getCellType());
                weightMap.put(cd.getId(), cd.getWeight());
            }
        }

        cellTypeMap.put(targetNode, CellType.TARGET);
        cellTypeMap.put(startNode, CellType.START);
        weightMap.put(startNode, 0); // START contributes zero entry cost

        Map<String, CellState> stateMap = new HashMap<>();
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                String id = NodeIdUtil.format(r, c);
                stateMap.put(id, new CellState(cellTypeMap.get(id), TraversalState.UNVISITED, false, null, null, null, null));
            }
        }

        List<TraceDelta> traceDeltas = new ArrayList<>();
        List<Keyframe> keyframes = new ArrayList<>();
        int[] stepCounter = new int[]{0};
        int maxFrontierSize = 0;
        int visitedCount = 0;
        Set<String> closedSet = new HashSet<>();
        String[] activeNodeRef = new String[]{null};
        Supplier<List<String>>[] frontierSupplier = new Supplier[]{() -> Collections.emptyList()};

        Consumer<Integer> captureKeyframe = (frontierSize) -> {
            int stepNum = stepCounter[0] - 1;
            Map<String, CellState> snapshot = new HashMap<>();
            for (Map.Entry<String, CellState> entry : stateMap.entrySet()) {
                snapshot.put(entry.getKey(), entry.getValue().copy());
            }
            keyframes.add(new Keyframe(
                    stepNum,
                    snapshot,
                    new ArrayList<>(frontierSupplier[0].get()),
                    activeNodeRef[0],
                    closedSet.size()
            ));
        };

        // Delta recorder
        java.util.function.Function<DeltaParams, TraceDelta> recordDelta = (params) -> {
            CellState before = null;
            CellState after = null;

            if (params.nodeId != null && stateMap.containsKey(params.nodeId)) {
                before = stateMap.get(params.nodeId).copy();
                after = before.copy();
                if (params.traversalState != null) after.setTraversalState(params.traversalState);
                if (params.inPath != null) after.setInPath(params.inPath);
                if (params.gCost != null) after.setGCost(params.gCost);
                if (params.hCost != null) after.setHCost(params.hCost);
                if (params.fCost != null) after.setFCost(params.fCost);
                if (params.parentIdSet) after.setParentId(params.parentId);

                stateMap.put(params.nodeId, after);
            }

            TraceDelta delta = new TraceDelta(
                    stepCounter[0]++,
                    params.action,
                    params.operationSubtype,
                    params.nodeId,
                    before,
                    after,
                    params.frontierSize,
                    params.heapSwaps,
                    params.details
            );
            traceDeltas.add(delta);

            if (delta.getStep() % 50 == 0) {
                captureKeyframe.accept(params.frontierSize);
            }

            return delta;
        };

        boolean pathFound = false;
        List<String> path = new ArrayList<>();
        int pathNodeCount = 0;
        int pathEdgeCount = 0;
        Integer algorithmPathCost = null;
        Integer terrainPathCost = null;

        // Special Case: Start equals target
        if (startNode.equals(targetNode)) {
            // Step 0: INITIALIZE
            DeltaParams p0 = new DeltaParams(TraceAction.INITIALIZE, startNode, 0);
            p0.traversalState = TraversalState.ACTIVE;
            p0.gCost = 0;
            p0.hCost = 0;
            p0.fCost = 0;
            p0.parentId = null;
            p0.parentIdSet = true;
            p0.details = "Start equals target initialization";
            recordDelta.apply(p0);

            // Step 1: PATH_FOUND
            DeltaParams p1 = new DeltaParams(TraceAction.PATH_FOUND, startNode, 0);
            p1.inPath = true;
            p1.traversalState = TraversalState.CLOSED;
            p1.details = "Target is start node";
            recordDelta.apply(p1);

            path = List.of(startNode);
            pathNodeCount = 1;
            pathEdgeCount = 0;
            algorithmPathCost = 0;
            terrainPathCost = 0;
            visitedCount = 1;

            double executionTimeMs = Math.max(0.01, (double) (System.currentTimeMillis() - startTime));
            ExecutionMetrics metrics = new ExecutionMetrics(
                    1, 0, 0, 0, 1, 0, executionTimeMs, traceDeltas.size()
            );

            PathfindingResponse resp = new PathfindingResponse();
            resp.setAlgorithm(algorithm);
            resp.setPathFound(true);
            resp.setPath(path);
            resp.setPathNodeCount(1);
            resp.setPathEdgeCount(0);
            resp.setAlgorithmPathCost(0);
            resp.setTerrainPathCost(0);
            resp.setTraceDeltas(traceDeltas);
            resp.setKeyframes(keyframes);
            resp.setMetrics(metrics);
            resp.setReversible(true);
            resp.setNoPathReason(null);
            return resp;
        }

        // Normal Execution
        if (algorithm == AlgorithmType.BFS) {
            FifoQueueFrontier queue = new FifoQueueFrontier();
            frontierSupplier[0] = queue::getFrontierIds;

            // INITIALIZE start
            DeltaParams initP = new DeltaParams(TraceAction.INITIALIZE, startNode, 1);
            initP.traversalState = TraversalState.FRONTIER;
            initP.gCost = 0;
            initP.hCost = 0;
            initP.fCost = 0;
            initP.parentId = null;
            initP.parentIdSet = true;
            initP.details = "Initialize start node in BFS queue";
            recordDelta.apply(initP);

            queue.push(startNode);
            maxFrontierSize = Math.max(maxFrontierSize, queue.size());

            while (!queue.isEmpty()) {
                maxFrontierSize = Math.max(maxFrontierSize, queue.size());
                String currId = queue.pop();

                DeltaParams deqP = new DeltaParams(TraceAction.DEQUEUE_FRONTIER, currId, queue.size());
                recordDelta.apply(deqP);

                activeNodeRef[0] = currId;
                DeltaParams examP = new DeltaParams(TraceAction.EXAMINE_NODE, currId, queue.size());
                examP.traversalState = TraversalState.ACTIVE;
                recordDelta.apply(examP);
                visitedCount++;

                if (currId.equals(targetNode)) {
                    pathFound = true;
                    closedSet.add(currId);
                    DeltaParams closeP = new DeltaParams(TraceAction.CLOSE_NODE, currId, queue.size());
                    closeP.traversalState = TraversalState.CLOSED;
                    recordDelta.apply(closeP);
                    activeNodeRef[0] = null;
                    break;
                }

                int[] currPos = NodeIdUtil.parse(currId);
                int currGCost = stateMap.get(currId).getGCost();

                for (Direction dir : DIRECTIONS) {
                    int nr = currPos[0] + dir.dr;
                    int nc = currPos[1] + dir.dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

                    String nId = NodeIdUtil.format(nr, nc);
                    if (cellTypeMap.get(nId) == CellType.WALL) continue;
                    if (queue.contains(nId) || closedSet.contains(nId)) continue;

                    int newGCost = currGCost + 1;
                    queue.push(nId);
                    maxFrontierSize = Math.max(maxFrontierSize, queue.size());

                    DeltaParams enqP = new DeltaParams(TraceAction.ENQUEUE_FRONTIER, nId, queue.size());
                    enqP.traversalState = TraversalState.FRONTIER;
                    enqP.gCost = newGCost;
                    enqP.fCost = newGCost;
                    enqP.parentId = currId;
                    enqP.parentIdSet = true;
                    recordDelta.apply(enqP);
                }

                closedSet.add(currId);
                DeltaParams closeP = new DeltaParams(TraceAction.CLOSE_NODE, currId, queue.size());
                closeP.traversalState = TraversalState.CLOSED;
                recordDelta.apply(closeP);
                activeNodeRef[0] = null;
            }

        } else if (algorithm == AlgorithmType.DFS) {
            LifoStackFrontier stack = new LifoStackFrontier();
            frontierSupplier[0] = stack::getFrontierIds;

            // INITIALIZE start
            DeltaParams initP = new DeltaParams(TraceAction.INITIALIZE, startNode, 1);
            initP.traversalState = TraversalState.FRONTIER;
            initP.gCost = 0;
            initP.hCost = 0;
            initP.fCost = 0;
            initP.parentId = null;
            initP.parentIdSet = true;
            initP.details = "Initialize start node in DFS stack";
            recordDelta.apply(initP);

            stack.push(startNode);
            maxFrontierSize = Math.max(maxFrontierSize, stack.size());

            while (!stack.isEmpty()) {
                maxFrontierSize = Math.max(maxFrontierSize, stack.size());
                String currId = stack.pop();

                DeltaParams deqP = new DeltaParams(TraceAction.DEQUEUE_FRONTIER, currId, stack.size());
                recordDelta.apply(deqP);

                activeNodeRef[0] = currId;
                DeltaParams examP = new DeltaParams(TraceAction.EXAMINE_NODE, currId, stack.size());
                examP.traversalState = TraversalState.ACTIVE;
                recordDelta.apply(examP);
                visitedCount++;

                if (currId.equals(targetNode)) {
                    pathFound = true;
                    closedSet.add(currId);
                    DeltaParams closeP = new DeltaParams(TraceAction.CLOSE_NODE, currId, stack.size());
                    closeP.traversalState = TraversalState.CLOSED;
                    recordDelta.apply(closeP);
                    activeNodeRef[0] = null;
                    break;
                }

                int[] currPos = NodeIdUtil.parse(currId);
                int currGCost = stateMap.get(currId).getGCost();

                // DFS push order: LEFT, DOWN, RIGHT, UP so that pop order is UP, RIGHT, DOWN, LEFT
                for (Direction dir : REVERSE_DIRECTIONS) {
                    int nr = currPos[0] + dir.dr;
                    int nc = currPos[1] + dir.dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

                    String nId = NodeIdUtil.format(nr, nc);
                    if (cellTypeMap.get(nId) == CellType.WALL) continue;
                    if (stack.contains(nId) || closedSet.contains(nId)) continue;

                    int newGCost = currGCost + 1;
                    stack.push(nId);
                    maxFrontierSize = Math.max(maxFrontierSize, stack.size());

                    DeltaParams enqP = new DeltaParams(TraceAction.ENQUEUE_FRONTIER, nId, stack.size());
                    enqP.traversalState = TraversalState.FRONTIER;
                    enqP.gCost = newGCost;
                    enqP.fCost = newGCost;
                    enqP.parentId = currId;
                    enqP.parentIdSet = true;
                    recordDelta.apply(enqP);
                }

                closedSet.add(currId);
                DeltaParams closeP = new DeltaParams(TraceAction.CLOSE_NODE, currId, stack.size());
                closeP.traversalState = TraversalState.CLOSED;
                recordDelta.apply(closeP);
                activeNodeRef[0] = null;
            }

        } else if (algorithm == AlgorithmType.DIJKSTRA || algorithm == AlgorithmType.ASTAR) {
            boolean isAStar = (algorithm == AlgorithmType.ASTAR);
            IndexedMinHeapFrontier heap = new IndexedMinHeapFrontier(isAStar);
            frontierSupplier[0] = heap::getFrontierIds;
            long enqueueSeq = 0;

            int[] startPos = NodeIdUtil.parse(startNode);
            int[] targetPos = NodeIdUtil.parse(targetNode);

            int startH = isAStar ? HeuristicCalculator.calculate(request.getHeuristic(), startPos[0], startPos[1], targetPos[0], targetPos[1]) : 0;
            int startF = startH;

            heap.push(new IndexedMinHeapFrontier.HeapNode(startNode, startPos[0], startPos[1], 0, startH, startF, enqueueSeq++));
            heap.drainSwaps();
            maxFrontierSize = Math.max(maxFrontierSize, heap.size());

            // INITIALIZE start
            DeltaParams initP = new DeltaParams(TraceAction.INITIALIZE, startNode, 1);
            initP.traversalState = TraversalState.FRONTIER;
            initP.gCost = 0;
            initP.hCost = startH;
            initP.fCost = startF;
            initP.parentId = null;
            initP.parentIdSet = true;
            initP.details = "Initialize start node in indexed min-heap";
            recordDelta.apply(initP);

            while (!heap.isEmpty()) {
                maxFrontierSize = Math.max(maxFrontierSize, heap.size());
                IndexedMinHeapFrontier.HeapNode top = heap.pop();
                List<HeapSwap> popSwaps = heap.drainSwaps();

                DeltaParams deqP = new DeltaParams(TraceAction.DEQUEUE_FRONTIER, top.id, heap.size());
                deqP.heapSwaps = popSwaps;
                recordDelta.apply(deqP);

                activeNodeRef[0] = top.id;
                DeltaParams examP = new DeltaParams(TraceAction.EXAMINE_NODE, top.id, heap.size());
                examP.traversalState = TraversalState.ACTIVE;
                recordDelta.apply(examP);
                visitedCount++;

                if (top.id.equals(targetNode)) {
                    pathFound = true;
                    closedSet.add(top.id);
                    DeltaParams closeP = new DeltaParams(TraceAction.CLOSE_NODE, top.id, heap.size());
                    closeP.traversalState = TraversalState.CLOSED;
                    recordDelta.apply(closeP);
                    activeNodeRef[0] = null;
                    break;
                }

                int currGCost = top.gCost;

                for (Direction dir : DIRECTIONS) {
                    int nr = top.row + dir.dr;
                    int nc = top.col + dir.dc;
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

                    String nId = NodeIdUtil.format(nr, nc);
                    if (cellTypeMap.get(nId) == CellType.WALL) continue;
                    if (closedSet.contains(nId)) continue;

                    int entryCost = weightMap.get(nId);
                    int newGCost = currGCost + entryCost;
                    int hCost = isAStar ? HeuristicCalculator.calculate(request.getHeuristic(), nr, nc, targetPos[0], targetPos[1]) : 0;
                    int newFCost = newGCost + hCost;

                    if (heap.contains(nId)) {
                        CellState currNeigh = stateMap.get(nId);
                        if (newGCost < currNeigh.getGCost()) {
                            heap.decreaseKey(nId, newGCost, newFCost);
                            List<HeapSwap> decSwaps = heap.drainSwaps();

                            DeltaParams decP = new DeltaParams(TraceAction.ENQUEUE_FRONTIER, nId, heap.size());
                            decP.operationSubtype = "DECREASE_KEY";
                            decP.gCost = newGCost;
                            decP.fCost = newFCost;
                            decP.parentId = top.id;
                            decP.parentIdSet = true;
                            decP.heapSwaps = decSwaps;
                            decP.details = "DECREASE_KEY: Relaxation via " + top.id;
                            recordDelta.apply(decP);
                        }
                    } else {
                        heap.push(new IndexedMinHeapFrontier.HeapNode(nId, nr, nc, newGCost, hCost, newFCost, enqueueSeq++));
                        List<HeapSwap> pushSwaps = heap.drainSwaps();

                        DeltaParams enqP = new DeltaParams(TraceAction.ENQUEUE_FRONTIER, nId, heap.size());
                        enqP.traversalState = TraversalState.FRONTIER;
                        enqP.gCost = newGCost;
                        enqP.hCost = hCost;
                        enqP.fCost = newFCost;
                        enqP.parentId = top.id;
                        enqP.parentIdSet = true;
                        enqP.heapSwaps = pushSwaps;
                        recordDelta.apply(enqP);

                        maxFrontierSize = Math.max(maxFrontierSize, heap.size());
                    }
                }

                closedSet.add(top.id);
                DeltaParams closeP = new DeltaParams(TraceAction.CLOSE_NODE, top.id, heap.size());
                closeP.traversalState = TraversalState.CLOSED;
                recordDelta.apply(closeP);
                activeNodeRef[0] = null;
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
            pathNodeCount = path.size();
            pathEdgeCount = Math.max(0, path.size() - 1);

            int terrainCost = 0;
            for (int i = 1; i < path.size(); i++) {
                terrainCost += weightMap.get(path.get(i));
            }
            terrainPathCost = terrainCost;

            if (algorithm == AlgorithmType.BFS || algorithm == AlgorithmType.DFS) {
                algorithmPathCost = pathEdgeCount;
            } else {
                algorithmPathCost = terrainCost;
            }

            // Final event: PATH_FOUND
            for (String pId : path) {
                DeltaParams pFoundP = new DeltaParams(TraceAction.PATH_FOUND, pId, 0);
                pFoundP.inPath = true;
                recordDelta.apply(pFoundP);
            }
        } else {
            path = Collections.emptyList();
            pathNodeCount = 0;
            pathEdgeCount = 0;
            algorithmPathCost = null;
            terrainPathCost = null;

            // Final event: NO_PATH_FOUND with reason FRONTIER_EXHAUSTED
            DeltaParams noPathP = new DeltaParams(TraceAction.NO_PATH_FOUND, null, 0);
            noPathP.details = "FRONTIER_EXHAUSTED";
            recordDelta.apply(noPathP);
        }

        double executionTimeMs = Math.max(0.01, (double) (System.currentTimeMillis() - startTime));

        ExecutionMetrics metrics = new ExecutionMetrics(
                pathNodeCount,
                pathEdgeCount,
                algorithmPathCost,
                terrainPathCost,
                visitedCount,
                maxFrontierSize,
                executionTimeMs,
                traceDeltas.size()
        );

        PathfindingResponse resp = new PathfindingResponse();
        resp.setAlgorithm(algorithm);
        resp.setPathFound(pathFound);
        resp.setPath(path);
        resp.setPathNodeCount(pathNodeCount);
        resp.setPathEdgeCount(pathEdgeCount);
        resp.setAlgorithmPathCost(algorithmPathCost);
        resp.setTerrainPathCost(terrainPathCost);
        resp.setTraceDeltas(traceDeltas);
        resp.setKeyframes(keyframes);
        resp.setMetrics(metrics);
        resp.setReversible(true);
        resp.setNoPathReason(pathFound ? null : "FRONTIER_EXHAUSTED");

        return resp;
    }

    private static class DeltaParams {
        final TraceAction action;
        String operationSubtype;
        final String nodeId;
        final int frontierSize;
        TraversalState traversalState;
        Boolean inPath;
        Integer gCost;
        Integer hCost;
        Integer fCost;
        String parentId;
        boolean parentIdSet = false;
        List<HeapSwap> heapSwaps = new ArrayList<>();
        String details;

        DeltaParams(TraceAction action, String nodeId, int frontierSize) {
            this.action = action;
            this.nodeId = nodeId;
            this.frontierSize = frontierSize;
        }
    }
}
