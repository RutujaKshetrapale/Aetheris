package com.aetheris.domain.model;

import java.util.ArrayList;
import java.util.List;

public class GridModel {
    private int rows;
    private int cols;
    private String startNode;
    private String targetNode;
    private List<CellDefinition> cells = new ArrayList<>();

    public GridModel() {}

    public GridModel(int rows, int cols, String startNode, String targetNode, List<CellDefinition> cells) {
        this.rows = rows;
        this.cols = cols;
        this.startNode = startNode;
        this.targetNode = targetNode;
        this.cells = cells != null ? cells : new ArrayList<>();
    }

    public int getRows() { return rows; }
    public void setRows(int rows) { this.rows = rows; }

    public int getCols() { return cols; }
    public void setCols(int cols) { this.cols = cols; }

    public String getStartNode() { return startNode; }
    public void setStartNode(String startNode) { this.startNode = startNode; }

    public String getTargetNode() { return targetNode; }
    public void setTargetNode(String targetNode) { this.targetNode = targetNode; }

    public List<CellDefinition> getCells() { return cells; }
    public void setCells(List<CellDefinition> cells) { this.cells = cells; }
}
