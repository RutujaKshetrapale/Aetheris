package com.aetheris.adapter.web;

import com.aetheris.domain.model.HealthStatus;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/health")
@CrossOrigin(origins = "*")
public class HealthController {

    private final PresetRepositoryPort presetRepository;
    private final String persistenceEngine;
    private final String version;

    public HealthController(PresetRepositoryPort presetRepository,
                            @Value("${aetheris.persistence.engine:IN_MEMORY}") String persistenceEngine,
                            @Value("${aetheris.version:2.1.0}") String version) {
        this.presetRepository = presetRepository;
        this.persistenceEngine = persistenceEngine;
        this.version = version;
    }

    @GetMapping
    public ResponseEntity<HealthStatus> getHealth() {
        boolean dbConnected = presetRepository.isAvailable();
        HealthStatus status = new HealthStatus(
                "UP",
                "Spring Boot 3.2.5 (Java 21)",
                version,
                persistenceEngine.toUpperCase(),
                dbConnected
        );
        return ResponseEntity.ok(status);
    }
}
