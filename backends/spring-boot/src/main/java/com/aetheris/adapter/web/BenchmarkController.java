package com.aetheris.adapter.web;

import com.aetheris.application.BenchmarkApplicationService;
import com.aetheris.domain.model.BenchmarkRecord;
import com.aetheris.domain.model.BenchmarkRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/benchmarks")
public class BenchmarkController {

    private final BenchmarkApplicationService benchmarkService;

    public BenchmarkController(BenchmarkApplicationService benchmarkService) {
        this.benchmarkService = benchmarkService;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BenchmarkRecord> runBenchmark(@RequestBody BenchmarkRequest request) {
        BenchmarkRecord created = benchmarkService.runAndRecordBenchmark(request);
        return ResponseEntity.created(URI.create("/api/v1/benchmarks/" + created.getId())).body(created);
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BenchmarkRecord> getBenchmark(@PathVariable String id) {
        return ResponseEntity.ok(benchmarkService.getBenchmarkById(id));
    }
}
