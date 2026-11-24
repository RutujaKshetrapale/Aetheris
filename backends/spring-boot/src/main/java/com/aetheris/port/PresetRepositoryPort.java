package com.aetheris.port;

import com.aetheris.domain.model.GridPreset;
import java.util.List;
import java.util.Optional;

public interface PresetRepositoryPort {
    List<GridPreset> findAll();
    Optional<GridPreset> findById(String id);
    GridPreset save(GridPreset preset);
    String getAdapterType();
    boolean isAvailable();
}
