package com.aetheris.adapter.persistence.mysql;

import jakarta.persistence.*;

@Entity
@Table(name = "preset_cells")
public class PresetCellEntity {

    @EmbeddedId
    private PresetCellId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("presetId")
    @JoinColumn(name = "preset_id", nullable = false)
    private PresetEntity preset;

    @Column(name = "cell_row", nullable = false)
    private int cellRow;

    @Column(name = "cell_col", nullable = false)
    private int cellCol;

    @Column(name = "cell_type", length = 16, nullable = false)
    private String cellType;

    @Column(name = "weight", nullable = false)
    private int weight = 1;

    public PresetCellEntity() {}

    public PresetCellId getId() { return id; }
    public void setId(PresetCellId id) { this.id = id; }

    public PresetEntity getPreset() { return preset; }
    public void setPreset(PresetEntity preset) { this.preset = preset; }

    public int getCellRow() { return cellRow; }
    public void setCellRow(int cellRow) { this.cellRow = cellRow; }

    public int getCellCol() { return cellCol; }
    public void setCellCol(int cellCol) { this.cellCol = cellCol; }

    public String getCellType() { return cellType; }
    public void setCellType(String cellType) { this.cellType = cellType; }

    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
}
