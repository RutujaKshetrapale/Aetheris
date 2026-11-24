package com.aetheris.adapter.persistence;

import com.aetheris.domain.model.GridPreset;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class MongoPresetAdapter implements PresetRepositoryPort {

    private final InMemoryPresetAdapter fallback;
    private final boolean enabled;

    public MongoPresetAdapter(InMemoryPresetAdapter fallback,
                              @Value("${aetheris.persistence.engine:IN_MEMORY}") String engine) {
        this.fallback = fallback;
        this.enabled = "MONGODB".equalsIgnoreCase(engine);
    }

    @Override
    public List<GridPreset> findAll() {
        return fallback.findAll();
    }

    @Override
    public Optional<GridPreset> findById(String id) {
        return fallback.findById(id);
    }

    @Override
    public GridPreset save(GridPreset preset) {
        return fallback.save(preset);
    }

    @Override
    public String getAdapterType() {
        return "MONGODB";
    }

    @Override
    public boolean isAvailable() {
        return enabled;
    }
}
