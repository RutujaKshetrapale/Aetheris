package com.aetheris.domain.model;

public class CellState {
    private CellType cellType;
    private TraversalState traversalState;
    private boolean inPath;
    private Double gCost;
    private Double fCost;
    private String parentId;

    public CellState() {}

    public CellState(CellType cellType, TraversalState traversalState, boolean inPath, Double gCost, Double fCost, String parentId) {
        this.cellType = cellType;
        this.traversalState = traversalState;
        this.inPath = inPath;
        this.gCost = gCost;
        this.fCost = fCost;
        this.parentId = parentId;
    }

    public CellState copy() {
        return new CellState(this.cellType, this.traversalState, this.inPath, this.gCost, this.fCost, this.parentId);
    }

    public CellType getCellType() { return cellType; }
    public void setCellType(CellType cellType) { this.cellType = cellType; }

    public TraversalState getTraversalState() { return traversalState; }
    public void setTraversalState(TraversalState traversalState) { this.traversalState = traversalState; }

    public boolean isInPath() { return inPath; }
    public void setInPath(boolean inPath) { this.inPath = inPath; }

    public Double getGCost() { return gCost; }
    public void setGCost(Double gCost) { this.gCost = gCost; }

    public Double getFCost() { return fCost; }
    public void setFCost(Double fCost) { this.fCost = fCost; }

    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }
}
