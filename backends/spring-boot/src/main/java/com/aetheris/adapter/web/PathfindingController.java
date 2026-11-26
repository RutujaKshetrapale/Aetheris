package com.aetheris.adapter.web;

import com.aetheris.algorithm.PathfindingEngine;
import com.aetheris.domain.model.AlgorithmInfo;
import com.aetheris.domain.model.AlgorithmType;
import com.aetheris.domain.model.PathfindingRequest;
import com.aetheris.domain.model.PathfindingResponse;
import com.aetheris.domain.model.ProblemDetails;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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

    @PostMapping(value = "/trace", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> tracePath(@RequestBody PathfindingRequest request) {
        try {
            PathfindingResponse response = engine.execute(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            ProblemDetails problem = new ProblemDetails(
                    "https://aetheris.dev/errors/bad-request",
                    "Invalid Request Parameters",
                    HttpStatus.BAD_REQUEST.value(),
                    ex.getMessage(),
                    "/api/v1/pathfinding/trace"
            );
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .header("Content-Type", "application/problem+json")
                    .body(problem);
        }
    }

    @GetMapping("/algorithms")
    public ResponseEntity<List<AlgorithmInfo>> getAlgorithms() {
        List<AlgorithmInfo> list = List.of(
                new AlgorithmInfo(AlgorithmType.BFS, "Breadth-First Search (BFS)", "Explores nodes level by level using a FIFO queue. Guarantees shortest path on unweighted graphs.", false, true, "FIFO_QUEUE"),
                new AlgorithmInfo(AlgorithmType.DFS, "Depth-First Search (DFS)", "Explores along branches to maximum depth using a LIFO stack. Does not guarantee shortest path.", false, false, "LIFO_STACK"),
                new AlgorithmInfo(AlgorithmType.DIJKSTRA, "Dijkstra's Algorithm", "Finds optimal path using deterministic indexed min-heap. Guarantees shortest path with integer positive weights.", true, true, "INDEXED_MIN_HEAP"),
                new AlgorithmInfo(AlgorithmType.ASTAR, "A* Heuristic Search", "Directed search combining actual cost g(n) and integer Manhattan heuristic h(n) via deterministic indexed min-heap.", true, true, "INDEXED_MIN_HEAP")
        );
        return ResponseEntity.ok(list);
    }
}
