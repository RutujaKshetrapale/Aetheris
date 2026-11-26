package com.aetheris.adapter.persistence;

import com.aetheris.domain.model.GridPreset;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Architectural Boundary: MongoDB Adapter
 * Status: PENDING (Phase 1 Foundation - Operational adapter is InMemoryPresetAdapter)
 */
public class MongoPresetAdapter implements PresetRepositoryPort {

    private final boolean enabled;

    public MongoPresetAdapter(@Value("${aetheris.persistence.engine:IN_MEMORY}") String engine) {
        this.enabled = "MONGODB".equalsIgnoreCase(engine);
    }

    @Override
    public List<GridPreset> findAll() {
        return Collections.emptyList();
    }

    @Override
    public Optional<GridPreset> findById(String id) {
        return Optional.empty();
    }

    @Override
    public GridPreset save(GridPreset preset) {
        throw new UnsupportedOperationException("MongoDB persistence adapter pending Phase 2 implementation.");
    }

    @Override
    public String getAdapterType() {
        return "MONGODB";
    }

    @Override
    public boolean isAvailable() {
        // Architectural boundary: returns false in Phase 1 to trigger 503 RFC 9457 Problem Details
        return false;
    }
}
