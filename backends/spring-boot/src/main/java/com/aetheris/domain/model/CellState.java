package com.aetheris.domain.model;

public class CellState {
    private CellType cellType;
    private TraversalState traversalState;
    private boolean inPath;
    private Integer gCost;
    private Integer hCost;
    private Integer fCost;
    private String parentId;

    public CellState() {}

    public CellState(CellType cellType, TraversalState traversalState, boolean inPath, Integer gCost, Integer hCost, Integer fCost, String parentId) {
        this.cellType = cellType;
        this.traversalState = traversalState;
        this.inPath = inPath;
        this.gCost = gCost;
        this.hCost = hCost;
        this.fCost = fCost;
        this.parentId = parentId;
    }

    public CellState copy() {
        return new CellState(this.cellType, this.traversalState, this.inPath, this.gCost, this.hCost, this.fCost, this.parentId);
    }

    public CellType getCellType() { return cellType; }
    public void setCellType(CellType cellType) { this.cellType = cellType; }

    public TraversalState getTraversalState() { return traversalState; }
    public void setTraversalState(TraversalState traversalState) { this.traversalState = traversalState; }

    public boolean isInPath() { return inPath; }
    public void setInPath(boolean inPath) { this.inPath = inPath; }

    public Integer getGCost() { return gCost; }
    public void setGCost(Integer gCost) { this.gCost = gCost; }

    public Integer getHCost() { return hCost; }
    public void setHCost(Integer hCost) { this.hCost = hCost; }

    public Integer getFCost() { return fCost; }
    public void setFCost(Integer fCost) { this.fCost = fCost; }

    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }
}
