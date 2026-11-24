package com.aetheris.adapter.persistence;

import com.aetheris.domain.model.CellDefinition;
import com.aetheris.domain.model.CellType;
import com.aetheris.domain.model.GridModel;
import com.aetheris.domain.model.GridPreset;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class InMemoryPresetAdapter implements PresetRepositoryPort {

    private final Map<String, GridPreset> storage = new ConcurrentHashMap<>();

    public InMemoryPresetAdapter() {
        initDefaultPresets();
    }

    private void initDefaultPresets() {
        // Preset 1: Canonical 5x5 Obstacle Grid
        List<CellDefinition> cells = List.of(
                new CellDefinition("r0c0", 0, 0, CellType.START, 1.0),
                new CellDefinition("r4c4", 4, 4, CellType.TARGET, 1.0),
                new CellDefinition("r1c2", 1, 2, CellType.WALL, 1.0),
                new CellDefinition("r2c2", 2, 2, CellType.WALL, 1.0),
                new CellDefinition("r3c2", 3, 2, CellType.WALL, 1.0),
                new CellDefinition("r0c2", 0, 2, CellType.WEIGHTED, 5.0)
        );
        GridModel grid5x5 = new GridModel(5, 5, "r0c0", "r4c4", cells);
        GridPreset preset1 = new GridPreset("preset-canonical-5x5", "Canonical 5x5 Obstacle Grid", "Standard benchmark grid with column 2 wall barrier and r0c2 weighted cell", grid5x5);
        storage.put(preset1.getId(), preset1);

        // Preset 2: Open 8x8 Grid
        List<CellDefinition> openCells = List.of(
                new CellDefinition("r0c0", 0, 0, CellType.START, 1.0),
                new CellDefinition("r7c7", 7, 7, CellType.TARGET, 1.0)
        );
        GridModel grid8x8 = new GridModel(8, 8, "r0c0", "r7c7", openCells);
        GridPreset preset2 = new GridPreset("preset-open-8x8", "Open 8x8 Grid", "Unobstructed 8x8 grid for heuristic distance and queue expansion visualization", grid8x8);
        storage.put(preset2.getId(), preset2);
    }

    @Override
    public List<GridPreset> findAll() {
        return new ArrayList<>(storage.values());
    }

    @Override
    public Optional<GridPreset> findById(String id) {
        return Optional.ofNullable(storage.get(id));
    }

    @Override
    public GridPreset save(GridPreset preset) {
        if (preset.getId() == null || preset.getId().isBlank()) {
            preset.setId("preset-" + UUID.randomUUID().toString().substring(0, 8));
        }
        storage.put(preset.getId(), preset);
        return preset;
    }

    @Override
    public String getAdapterType() {
        return "IN_MEMORY";
    }

    @Override
    public boolean isAvailable() {
        return true;
    }
}
