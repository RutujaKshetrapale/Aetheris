package com.aetheris.application;

import com.aetheris.algorithm.PathfindingEngine;
import com.aetheris.domain.model.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PathfindingApplicationService {

    private final PathfindingEngine engine;

    public PathfindingApplicationService(PathfindingEngine engine) {
        this.engine = engine;
    }

    public PathfindingResponse executeTrace(PathfindingRequest request) {
        return engine.execute(request);
    }

    public List<AlgorithmInfo> listAlgorithms() {
        return List.of(
                new AlgorithmInfo(AlgorithmType.BFS, "Breadth-First Search (BFS)", "Explores nodes level by level using a FIFO queue. Guarantees shortest path on unweighted graphs.", false, true, "FIFO_QUEUE"),
                new AlgorithmInfo(AlgorithmType.DFS, "Depth-First Search (DFS)", "Explores along branches to maximum depth using a LIFO stack. Does not guarantee shortest path.", false, false, "LIFO_STACK"),
                new AlgorithmInfo(AlgorithmType.DIJKSTRA, "Dijkstra's Algorithm", "Finds optimal path using deterministic indexed min-heap. Guarantees shortest path with integer positive weights.", true, true, "INDEXED_MIN_HEAP"),
                new AlgorithmInfo(AlgorithmType.ASTAR, "A* Heuristic Search", "Directed search combining actual cost g(n) and integer Manhattan heuristic h(n) via deterministic indexed min-heap.", true, true, "INDEXED_MIN_HEAP")
        );
    }

    public boolean isEngineReady() {
        return engine != null;
    }
}
