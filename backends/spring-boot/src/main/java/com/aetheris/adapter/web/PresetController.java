package com.aetheris.adapter.web;

import com.aetheris.domain.model.GridPreset;
import com.aetheris.domain.model.ProblemDetails;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/presets")
@CrossOrigin(origins = "*")
public class PresetController {

    private final PresetRepositoryPort presetRepository;

    public PresetController(PresetRepositoryPort presetRepository) {
        this.presetRepository = presetRepository;
    }

    @GetMapping
    public ResponseEntity<?> listPresets() {
        if (!presetRepository.isAvailable()) {
            ProblemDetails problem = new ProblemDetails(
                    "https://aetheris.dev/errors/service-unavailable",
                    "Persistence Layer Unavailable",
                    HttpStatus.SERVICE_UNAVAILABLE.value(),
                    "The requested database adapter is currently offline or pending Phase 2 implementation.",
                    "/api/v1/presets"
            );
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .header("Content-Type", "application/problem+json")
                    .body(problem);
        }
        return ResponseEntity.ok(presetRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getPreset(@PathVariable String id) {
        if (!presetRepository.isAvailable()) {
            ProblemDetails problem = new ProblemDetails(
                    "https://aetheris.dev/errors/service-unavailable",
                    "Persistence Layer Unavailable",
                    HttpStatus.SERVICE_UNAVAILABLE.value(),
                    "The requested database adapter is currently offline or pending Phase 2 implementation.",
                    "/api/v1/presets/" + id
            );
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .header("Content-Type", "application/problem+json")
                    .body(problem);
        }
        return presetRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> {
                    ProblemDetails problem = new ProblemDetails(
                            "https://aetheris.dev/errors/not-found",
                            "Resource Not Found",
                            HttpStatus.NOT_FOUND.value(),
                            "Preset with ID " + id + " was not found.",
                            "/api/v1/presets/" + id
                    );
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .header("Content-Type", "application/problem+json")
                            .body(problem);
                });
    }

    @PostMapping
    public ResponseEntity<?> savePreset(@RequestBody GridPreset preset) {
        if (!presetRepository.isAvailable()) {
            ProblemDetails problem = new ProblemDetails(
                    "https://aetheris.dev/errors/service-unavailable",
                    "Persistence Layer Unavailable",
                    HttpStatus.SERVICE_UNAVAILABLE.value(),
                    "The requested database adapter is currently offline or pending Phase 2 implementation.",
                    "/api/v1/presets"
            );
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .header("Content-Type", "application/problem+json")
                    .body(problem);
        }
        GridPreset saved = presetRepository.save(preset);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
