package com.aetheris.adapter.web;

import com.aetheris.application.PathfindingApplicationService;
import com.aetheris.domain.model.AlgorithmInfo;
import com.aetheris.domain.model.PathfindingRequest;
import com.aetheris.domain.model.PathfindingResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/pathfinding")
public class PathfindingController {

    private final PathfindingApplicationService pathfindingService;

    public PathfindingController(PathfindingApplicationService pathfindingService) {
        this.pathfindingService = pathfindingService;
    }

    @PostMapping(value = "/trace", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<PathfindingResponse> tracePath(@RequestBody PathfindingRequest request) {
        return ResponseEntity.ok(pathfindingService.executeTrace(request));
    }

    @GetMapping(value = "/algorithms", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<AlgorithmInfo>> getAlgorithms() {
        return ResponseEntity.ok(pathfindingService.listAlgorithms());
    }
}
