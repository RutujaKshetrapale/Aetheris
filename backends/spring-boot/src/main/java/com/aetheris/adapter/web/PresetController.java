package com.aetheris.adapter.web;

import com.aetheris.domain.model.GridPreset;
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
    public ResponseEntity<List<GridPreset>> listPresets() {
        return ResponseEntity.ok(presetRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GridPreset> getPreset(@PathVariable String id) {
        return presetRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<GridPreset> savePreset(@RequestBody GridPreset preset) {
        GridPreset saved = presetRepository.save(preset);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
