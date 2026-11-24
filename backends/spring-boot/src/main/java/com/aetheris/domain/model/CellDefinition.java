package com.aetheris.domain.model;

public class CellDefinition {
    private String id;
    private int row;
    private int col;
    private CellType cellType;
    private double weight = 1.0;

    public CellDefinition() {}

    public CellDefinition(String id, int row, int col, CellType cellType, double weight) {
        this.id = id;
        this.row = row;
        this.col = col;
        this.cellType = cellType;
        this.weight = weight;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public CellType getCellType() { return cellType; }
    public void setCellType(CellType cellType) { this.cellType = cellType; }

    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = weight; }
}
