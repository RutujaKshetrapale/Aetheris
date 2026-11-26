package com.aetheris.domain.model;

import java.util.List;

public class ImportPresetsResponse {
    private int importedCount;
    private List<GridPreset> presets;

    public ImportPresetsResponse() {}

    public ImportPresetsResponse(int importedCount, List<GridPreset> presets) {
        this.importedCount = importedCount;
        this.presets = presets;
    }

    public int getImportedCount() { return importedCount; }
    public void setImportedCount(int importedCount) { this.importedCount = importedCount; }

    public List<GridPreset> getPresets() { return presets; }
    public void setPresets(List<GridPreset> presets) { this.presets = presets; }
}
