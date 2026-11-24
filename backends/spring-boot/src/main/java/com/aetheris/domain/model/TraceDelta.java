package com.aetheris.domain.model;

public class TraceDelta {
    private int step;
    private String nodeId;
    private TraceAction action;
    private CellState beforeState;
    private CellState afterState;
    private int frontierSize;

    public TraceDelta() {}

    public TraceDelta(int step, String nodeId, TraceAction action, CellState beforeState, CellState afterState, int frontierSize) {
        this.step = step;
        this.nodeId = nodeId;
        this.action = action;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.frontierSize = frontierSize;
    }

    public int getStep() { return step; }
    public void setStep(int step) { this.step = step; }

    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }

    public TraceAction getAction() { return action; }
    public void setAction(TraceAction action) { this.action = action; }

    public CellState getBeforeState() { return beforeState; }
    public void setBeforeState(CellState beforeState) { this.beforeState = beforeState; }

    public CellState getAfterState() { return afterState; }
    public void setAfterState(CellState afterState) { this.afterState = afterState; }

    public int getFrontierSize() { return frontierSize; }
    public void setFrontierSize(int frontierSize) { this.frontierSize = frontierSize; }
}
