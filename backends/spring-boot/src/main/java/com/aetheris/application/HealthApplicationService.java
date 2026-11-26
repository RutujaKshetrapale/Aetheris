package com.aetheris.application;

import com.aetheris.domain.exception.EngineNotReadyException;
import com.aetheris.domain.model.HealthStatus;
import com.aetheris.domain.model.ProbeStatus;
import com.aetheris.port.BenchmarkRepositoryPort;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class HealthApplicationService {

    private final PathfindingApplicationService pathfindingService;
    private final PresetRepositoryPort presetRepository;
    private final BenchmarkRepositoryPort benchmarkRepository;
    private final String persistenceEngine;
    private final String version;

    public HealthApplicationService(
            PathfindingApplicationService pathfindingService,
            PresetRepositoryPort presetRepository,
            BenchmarkRepositoryPort benchmarkRepository,
            @Value("${aetheris.persistence.engine:IN_MEMORY}") String persistenceEngine,
            @Value("${aetheris.version:2.1.0}") String version) {
        this.pathfindingService = pathfindingService;
        this.presetRepository = presetRepository;
        this.benchmarkRepository = benchmarkRepository;
        this.persistenceEngine = persistenceEngine;
        this.version = version;
    }

    public HealthStatus getOverallHealth() {
        boolean engineReady = pathfindingService.isEngineReady();
        boolean persistenceAvailable = presetRepository.isAvailable() && benchmarkRepository.isAvailable();
        boolean databaseConnected = presetRepository.isDatabaseConnected() && benchmarkRepository.isDatabaseConnected();

        String engineStatus = engineReady ? "UP" : "DOWN";
        String persistenceStatus = persistenceAvailable ? "UP" : "UNAVAILABLE";
        String appStatus = engineReady ? "UP" : "DOWN";

        return new HealthStatus(
                appStatus,
                engineStatus,
                persistenceStatus,
                "Spring Boot 4.2.0 (Java 25)",
                version,
                persistenceEngine.toUpperCase(),
                databaseConnected
        );
    }

    public ProbeStatus getLiveness() {
        return new ProbeStatus("UP");
    }

    public ProbeStatus getReadiness() {
        if (!pathfindingService.isEngineReady()) {
            throw new EngineNotReadyException("Core pathfinding engine is not ready.");
        }
        return new ProbeStatus("UP");
    }
}
