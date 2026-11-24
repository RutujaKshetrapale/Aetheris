package com.aetheris.adapter.web;

import com.aetheris.algorithm.PathfindingEngine;
import com.aetheris.domain.model.AlgorithmInfo;
import com.aetheris.domain.model.AlgorithmType;
import com.aetheris.domain.model.PathfindingRequest;
import com.aetheris.domain.model.PathfindingResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/pathfinding")
@CrossOrigin(origins = "*")
public class PathfindingController {

    private final PathfindingEngine engine;

    public PathfindingController(PathfindingEngine engine) {
        this.engine = engine;
    }

    @PostMapping("/find")
    public ResponseEntity<PathfindingResponse> findPath(@RequestBody PathfindingRequest request) {
        if (request.getGrid() == null || request.getAlgorithm() == null) {
            return ResponseEntity.badRequest().build();
        }
        PathfindingResponse response = engine.execute(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/algorithms")
    public ResponseEntity<List<AlgorithmInfo>> getAlgorithms() {
        List<AlgorithmInfo> list = List.of(
                new AlgorithmInfo(AlgorithmType.BFS, "Breadth-First Search (BFS)", "Explores nodes level by level using a FIFO queue. Guarantees shortest path on unweighted graphs.", false, true, "FIFO_QUEUE"),
                new AlgorithmInfo(AlgorithmType.DFS, "Depth-First Search (DFS)", "Explores along branches to maximum depth using a LIFO stack. Does not guarantee shortest path.", false, false, "LIFO_STACK"),
                new AlgorithmInfo(AlgorithmType.DIJKSTRA, "Dijkstra's Algorithm", "Finds optimal path using deterministic indexed min-heap. Guarantees shortest path with positive weights.", true, true, "INDEXED_MIN_HEAP"),
                new AlgorithmInfo(AlgorithmType.ASTAR, "A* Heuristic Search", "Directed search combining actual cost g(n) and heuristic h(n) via deterministic indexed min-heap.", true, true, "INDEXED_MIN_HEAP")
        );
        return ResponseEntity.ok(list);
    }
}
