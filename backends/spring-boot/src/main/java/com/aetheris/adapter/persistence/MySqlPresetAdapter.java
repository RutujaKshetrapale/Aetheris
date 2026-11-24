package com.aetheris.adapter.persistence;

import com.aetheris.domain.model.GridPreset;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Architectural Boundary: MySQL Adapter
 * Status: PENDING (Phase 1 Foundation - Operational adapter is InMemoryPresetAdapter)
 */
@Component
public class MySqlPresetAdapter implements PresetRepositoryPort {

    private final boolean enabled;

    public MySqlPresetAdapter(@Value("${aetheris.persistence.engine:IN_MEMORY}") String engine) {
        this.enabled = "MYSQL".equalsIgnoreCase(engine);
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
        throw new UnsupportedOperationException("MySQL persistence adapter pending Phase 2 implementation.");
    }

    @Override
    public String getAdapterType() {
        return "MYSQL";
    }

    @Override
    public boolean isAvailable() {
        // Architectural boundary: returns false in Phase 1 to trigger 503 RFC 9457 Problem Details
        return false;
    }
}
