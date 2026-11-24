package com.aetheris.domain.model;

import java.util.ArrayList;
import java.util.List;

public class PathfindingResponse {
    private AlgorithmType algorithm;
    private boolean pathFound;
    private List<String> path = new ArrayList<>();
    private double pathCost;
    private List<TraceDelta> traceDeltas = new ArrayList<>();
    private ExecutionMetrics metrics;
    private boolean reversible = true;

    public PathfindingResponse() {}

    public AlgorithmType getAlgorithm() { return algorithm; }
    public void setAlgorithm(AlgorithmType algorithm) { this.algorithm = algorithm; }

    public boolean isPathFound() { return pathFound; }
    public void setPathFound(boolean pathFound) { this.pathFound = pathFound; }

    public List<String> getPath() { return path; }
    public void setPath(List<String> path) { this.path = path; }

    public double getPathCost() { return pathCost; }
    public void setPathCost(double pathCost) { this.pathCost = pathCost; }

    public List<TraceDelta> getTraceDeltas() { return traceDeltas; }
    public void setTraceDeltas(List<TraceDelta> traceDeltas) { this.traceDeltas = traceDeltas; }

    public ExecutionMetrics getMetrics() { return metrics; }
    public void setMetrics(ExecutionMetrics metrics) { this.metrics = metrics; }

    public boolean isReversible() { return reversible; }
    public void setReversible(boolean reversible) { this.reversible = reversible; }
}
