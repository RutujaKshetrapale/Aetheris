package com.aetheris.application;

import com.aetheris.domain.exception.ConflictException;
import com.aetheris.domain.exception.PersistenceUnavailableException;
import com.aetheris.domain.exception.ResourceNotFoundException;
import com.aetheris.domain.exception.SchemaValidationException;
import com.aetheris.domain.model.*;
import com.aetheris.domain.validation.GridValidator;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class PresetApplicationService {

    private final PresetRepositoryPort presetRepository;
    private final PresetBundleCodec bundleCodec;

    public PresetApplicationService(PresetRepositoryPort presetRepository, PresetBundleCodec bundleCodec) {
        this.presetRepository = presetRepository;
        this.bundleCodec = bundleCodec;
    }

    private void ensureAvailable() {
        if (!presetRepository.isAvailable()) {
            throw new PersistenceUnavailableException(
                    presetRepository.getAdapterType(),
                    "The configured " + presetRepository.getAdapterType() + " persistence adapter is unavailable in Phase 3."
            );
        }
    }

    public List<GridPreset> listPresets() {
        ensureAvailable();
        return presetRepository.findAll();
    }

    public GridPreset getPresetById(String id) {
        ensureAvailable();
        GridValidator.validateResourceId(id, "Preset");
        return presetRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Preset with ID " + id + " was not found."));
    }

    public GridPreset createPreset(SavePresetRequest request) {
        ensureAvailable();
        if (request == null) {
            throw new SchemaValidationException("Preset request body cannot be null.");
        }
        if (request.getName() == null || request.getName().isBlank()) {
            throw new SchemaValidationException("Preset name is required.");
        }
        GridValidator.validateGrid(request.getGrid());

        String id = request.getId();
        if (id != null && !id.isBlank()) {
            GridValidator.validateResourceId(id, "Preset");
            if (presetRepository.existsById(id)) {
                throw new ConflictException("Preset with ID " + id + " already exists.");
            }
        } else {
            id = null;
        }

        GridPreset preset = new GridPreset(id, request.getName().trim(), request.getDescription(), request.getGrid(), Instant.now().toString());
        return presetRepository.save(preset);
    }

    public GridPreset updatePreset(String id, SavePresetRequest request) {
        ensureAvailable();
        GridValidator.validateResourceId(id, "Preset");
        if (request == null) {
            throw new SchemaValidationException("Preset request body cannot be null.");
        }
        if (request.getId() != null && !request.getId().isBlank() && !request.getId().equals(id)) {
            throw new SchemaValidationException("Preset ID in request body does not match path ID.");
        }
        if (request.getName() == null || request.getName().isBlank()) {
            throw new SchemaValidationException("Preset name is required.");
        }
        GridValidator.validateGrid(request.getGrid());

        GridPreset existing = presetRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Preset with ID " + id + " was not found."));

        GridPreset updated = new GridPreset(
                id,
                request.getName().trim(),
                request.getDescription(),
                request.getGrid(),
                existing.getCreatedAt()
        );
        return presetRepository.save(updated);
    }

    public void deletePreset(String id) {
        ensureAvailable();
        GridValidator.validateResourceId(id, "Preset");
        boolean deleted = presetRepository.deleteById(id);
        if (!deleted) {
            throw new ResourceNotFoundException("Preset with ID " + id + " was not found.");
        }
    }

    public byte[] exportPresets(ExportPresetsRequest request) {
        ensureAvailable();
        List<GridPreset> toExport;
        if (request != null && request.getPresetIds() != null && !request.getPresetIds().isEmpty()) {
            toExport = new ArrayList<>(request.getPresetIds().size());
            for (String id : request.getPresetIds()) {
                GridValidator.validateResourceId(id, "Preset");
                GridPreset preset = presetRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Preset with ID " + id + " was not found."));
                toExport.add(preset);
            }
        } else {
            toExport = presetRepository.findAll();
        }
        return bundleCodec.encodePretty(toExport);
    }

    public ImportPresetsResponse importPresets(byte[] rawBundleBytes) {
        ensureAvailable();
        List<GridPreset> parsed = bundleCodec.decodeAndValidate(rawBundleBytes);
        List<GridPreset> saved = new ArrayList<>(parsed.size());
        for (GridPreset preset : parsed) {
            saved.add(presetRepository.save(preset));
        }
        return new ImportPresetsResponse(saved.size(), saved);
    }
}
