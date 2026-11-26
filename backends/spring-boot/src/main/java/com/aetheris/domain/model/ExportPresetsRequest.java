package com.aetheris.domain.model;

import java.util.List;

public class ExportPresetsRequest {
    private List<String> presetIds;

    public ExportPresetsRequest() {}

    public ExportPresetsRequest(List<String> presetIds) {
        this.presetIds = presetIds;
    }

    public List<String> getPresetIds() { return presetIds; }
    public void setPresetIds(List<String> presetIds) { this.presetIds = presetIds; }
}
