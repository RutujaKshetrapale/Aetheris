package com.aetheris.application;

import com.aetheris.algorithm.PathfindingEngine;
import com.aetheris.domain.exception.PersistenceUnavailableException;
import com.aetheris.domain.exception.ResourceNotFoundException;
import com.aetheris.domain.exception.SchemaValidationException;
import com.aetheris.domain.model.*;
import com.aetheris.domain.validation.GridValidator;
import com.aetheris.port.BenchmarkRepositoryPort;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class BenchmarkApplicationService {

    private final PathfindingEngine engine;
    private final BenchmarkRepositoryPort benchmarkRepository;
    private final PresetRepositoryPort presetRepository;

    public BenchmarkApplicationService(
            PathfindingEngine engine,
            BenchmarkRepositoryPort benchmarkRepository,
            PresetRepositoryPort presetRepository) {
        this.engine = engine;
        this.benchmarkRepository = benchmarkRepository;
        this.presetRepository = presetRepository;
    }

    private void ensureBenchmarkPersistenceAvailable() {
        if (!benchmarkRepository.isAvailable()) {
            throw new PersistenceUnavailableException(
                    benchmarkRepository.getAdapterType(),
                    "The configured " + benchmarkRepository.getAdapterType() + " benchmark persistence adapter is unavailable in Phase 3."
            );
        }
    }

    public BenchmarkRecord runAndRecordBenchmark(BenchmarkRequest request) {
        ensureBenchmarkPersistenceAvailable();
        if (request == null) {
            throw new SchemaValidationException("Benchmark request cannot be null.");
        }
        if (request.getAlgorithm() == null) {
            throw new SchemaValidationException("Benchmark algorithm must be specified.");
        }

        HeuristicType heuristic = request.getHeuristic() != null ? request.getHeuristic() : HeuristicType.MANHATTAN;
        GridModel grid = request.getGrid();
        String presetId = request.getPresetId();

        if (grid == null) {
            if (presetId == null || presetId.isBlank()) {
                throw new SchemaValidationException("Either 'grid' or 'presetId' must be provided for benchmark execution.");
            }
            if (!presetRepository.isAvailable()) {
                throw new PersistenceUnavailableException(
                        presetRepository.getAdapterType(),
                        "The configured " + presetRepository.getAdapterType() + " preset persistence adapter is unavailable in Phase 3."
                );
            }
            GridValidator.validateResourceId(presetId, "Preset");
            GridPreset preset = presetRepository.findById(presetId)
                    .orElseThrow(() -> new ResourceNotFoundException("Preset with ID " + presetId + " was not found."));
            grid = preset.getGrid();
        }

        PathfindingRequest pathRequest = new PathfindingRequest(request.getAlgorithm(), grid);
        pathRequest.setHeuristic(heuristic);

        GridValidator.validatePathfindingRequest(pathRequest);

        long startNanos = System.nanoTime();
        PathfindingResponse result = engine.execute(pathRequest);
        double measuredDurationMs = Math.max(0.01, Math.round(((System.nanoTime() - startNanos) / 1_000_000.0) * 1000.0) / 1000.0);

        ExecutionMetrics metrics = result.getMetrics();
        String id = "bench-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

        BenchmarkRecord record = new BenchmarkRecord(
                id,
                request.getName() != null && !request.getName().isBlank() ? request.getName().trim() : null,
                presetId != null && !presetId.isBlank() ? presetId : null,
                result.getAlgorithm(),
                heuristic,
                grid.getRows(),
                grid.getCols(),
                grid.getStartNode(),
                grid.getTargetNode(),
                result.isPathFound(),
                result.getPathNodeCount(),
                result.getPathEdgeCount(),
                result.getAlgorithmPathCost(),
                result.getTerrainPathCost(),
                metrics.getNodesVisited(),
                metrics.getMaxFrontierSize(),
                metrics.getTotalSteps(),
                measuredDurationMs,
                Instant.now().toString()
        );

        return benchmarkRepository.save(record);
    }

    public BenchmarkRecord getBenchmarkById(String id) {
        ensureBenchmarkPersistenceAvailable();
        GridValidator.validateResourceId(id, "Benchmark");
        return benchmarkRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Benchmark with ID " + id + " was not found."));
    }
}
