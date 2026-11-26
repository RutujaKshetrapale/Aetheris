package com.aetheris.domain.model;

import java.util.ArrayList;
import java.util.List;

public class TraceDelta {
    private int step;
    private TraceAction action;
    private String operationSubtype;
    private String nodeId;
    private CellState beforeState;
    private CellState afterState;
    private int frontierSize;
    private List<HeapSwap> heapSwaps = new ArrayList<>();
    private String details;

    public TraceDelta() {}

    public TraceDelta(int step, TraceAction action, String nodeId, CellState beforeState, CellState afterState, int frontierSize, List<HeapSwap> heapSwaps, String details) {
        this(step, action, null, nodeId, beforeState, afterState, frontierSize, heapSwaps, details);
    }

    public TraceDelta(int step, TraceAction action, String operationSubtype, String nodeId, CellState beforeState, CellState afterState, int frontierSize, List<HeapSwap> heapSwaps, String details) {
        this.step = step;
        this.action = action;
        this.operationSubtype = operationSubtype;
        this.nodeId = nodeId;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.frontierSize = frontierSize;
        this.heapSwaps = heapSwaps != null ? heapSwaps : new ArrayList<>();
        this.details = details;
    }

    public int getStep() { return step; }
    public void setStep(int step) { this.step = step; }

    public TraceAction getAction() { return action; }
    public void setAction(TraceAction action) { this.action = action; }

    public String getOperationSubtype() { return operationSubtype; }
    public void setOperationSubtype(String operationSubtype) { this.operationSubtype = operationSubtype; }

    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }

    public CellState getBeforeState() { return beforeState; }
    public void setBeforeState(CellState beforeState) { this.beforeState = beforeState; }

    public CellState getAfterState() { return afterState; }
    public void setAfterState(CellState afterState) { this.afterState = afterState; }

    public int getFrontierSize() { return frontierSize; }
    public void setFrontierSize(int frontierSize) { this.frontierSize = frontierSize; }

    public List<HeapSwap> getHeapSwaps() { return heapSwaps; }
    public void setHeapSwaps(List<HeapSwap> heapSwaps) { this.heapSwaps = heapSwaps; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }
}
