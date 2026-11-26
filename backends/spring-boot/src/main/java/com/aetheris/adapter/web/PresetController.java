package com.aetheris.adapter.web;

import com.aetheris.application.PresetApplicationService;
import com.aetheris.domain.model.ExportPresetsRequest;
import com.aetheris.domain.model.GridPreset;
import com.aetheris.domain.model.ImportPresetsResponse;
import com.aetheris.domain.model.SavePresetRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/presets")
public class PresetController {

    private static final MediaType APPLICATION_JSON_UTF8 = new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8);
    private final PresetApplicationService presetService;

    public PresetController(PresetApplicationService presetService) {
        this.presetService = presetService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<GridPreset>> listPresets() {
        return ResponseEntity.ok(presetService.listPresets());
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<GridPreset> getPreset(@PathVariable String id) {
        return ResponseEntity.ok(presetService.getPresetById(id));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<GridPreset> createPreset(@RequestBody SavePresetRequest request) {
        GridPreset created = presetService.createPreset(request);
        return ResponseEntity.created(URI.create("/api/v1/presets/" + created.getId())).body(created);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<GridPreset> updatePreset(@PathVariable String id, @RequestBody SavePresetRequest request) {
        return ResponseEntity.ok(presetService.updatePreset(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePreset(@PathVariable String id) {
        presetService.deletePreset(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/export", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> exportPresets(@RequestBody(required = false) ExportPresetsRequest request) {
        byte[] canonicalBundle = presetService.exportPresets(request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(APPLICATION_JSON_UTF8);
        return new ResponseEntity<>(canonicalBundle, headers, HttpStatus.OK);
    }

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ImportPresetsResponse> importPresets(@RequestBody(required = false) byte[] rawBundle) {
        return ResponseEntity.ok(presetService.importPresets(rawBundle));
    }
}
