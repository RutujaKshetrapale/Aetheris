package com.aetheris.domain.model;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Keyframe {
    private int step;
    private Map<String, CellState> cellStates = new HashMap<>();
    private List<String> frontier = new ArrayList<>();
    private String activeNode;
    private int closedCount;

    public Keyframe() {}

    public Keyframe(int step, Map<String, CellState> cellStates, List<String> frontier, String activeNode, int closedCount) {
        this.step = step;
        this.cellStates = cellStates != null ? cellStates : new HashMap<>();
        this.frontier = frontier != null ? frontier : new ArrayList<>();
        this.activeNode = activeNode;
        this.closedCount = closedCount;
    }

    public int getStep() { return step; }
    public void setStep(int step) { this.step = step; }

    public Map<String, CellState> getCellStates() { return cellStates; }
    public void setCellStates(Map<String, CellState> cellStates) { this.cellStates = cellStates; }

    public List<String> getFrontier() { return frontier; }
    public void setFrontier(List<String> frontier) { this.frontier = frontier; }

    public String getActiveNode() { return activeNode; }
    public void setActiveNode(String activeNode) { this.activeNode = activeNode; }

    public int getClosedCount() { return closedCount; }
    public void setClosedCount(int closedCount) { this.closedCount = closedCount; }
}
