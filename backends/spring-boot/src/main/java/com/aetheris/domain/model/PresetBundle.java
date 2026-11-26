package com.aetheris.domain.model;

import java.util.ArrayList;
import java.util.List;

public class PresetBundle {
    private String format;
    private String formatVersion;
    private String exportedAt;
    private String contentHash;
    private List<GridPreset> presets = new ArrayList<>();

    public PresetBundle() {}

    public PresetBundle(String format, String formatVersion, String exportedAt, String contentHash, List<GridPreset> presets) {
        this.format = format;
        this.formatVersion = formatVersion;
        this.exportedAt = exportedAt;
        this.contentHash = contentHash;
        this.presets = presets != null ? presets : new ArrayList<>();
    }

    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }

    public String getFormatVersion() { return formatVersion; }
    public void setFormatVersion(String formatVersion) { this.formatVersion = formatVersion; }

    public String getExportedAt() { return exportedAt; }
    public void setExportedAt(String exportedAt) { this.exportedAt = exportedAt; }

    public String getContentHash() { return contentHash; }
    public void setContentHash(String contentHash) { this.contentHash = contentHash; }

    public List<GridPreset> getPresets() { return presets; }
    public void setPresets(List<GridPreset> presets) { this.presets = presets; }
}
