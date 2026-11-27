package com.aetheris.adapter.persistence.mysql;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class PresetCellId implements Serializable {

    @Column(name = "preset_id", length = 64, nullable = false)
    private String presetId;

    @Column(name = "cell_id", length = 32, nullable = false)
    private String cellId;

    public PresetCellId() {}

    public PresetCellId(String presetId, String cellId) {
        this.presetId = presetId;
        this.cellId = cellId;
    }

    public String getPresetId() { return presetId; }
    public void setPresetId(String presetId) { this.presetId = presetId; }

    public String getCellId() { return cellId; }
    public void setCellId(String cellId) { this.cellId = cellId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PresetCellId that)) return false;
        return Objects.equals(presetId, that.presetId) && Objects.equals(cellId, that.cellId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(presetId, cellId);
    }
}
