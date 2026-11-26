package com.aetheris.adapter.web;

import com.aetheris.application.HealthApplicationService;
import com.aetheris.domain.model.HealthStatus;
import com.aetheris.domain.model.ProbeStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final HealthApplicationService healthService;

    public HealthController(HealthApplicationService healthService) {
        this.healthService = healthService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<HealthStatus> getHealth() {
        return ResponseEntity.ok(healthService.getOverallHealth());
    }

    @GetMapping(value = "/live", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ProbeStatus> getLiveness() {
        return ResponseEntity.ok(healthService.getLiveness());
    }

    @GetMapping(value = "/ready", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ProbeStatus> getReadiness() {
        return ResponseEntity.ok(healthService.getReadiness());
    }
}
