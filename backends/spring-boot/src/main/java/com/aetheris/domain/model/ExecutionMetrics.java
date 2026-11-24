package com.aetheris.domain.model;

public class ExecutionMetrics {
    private int nodesVisited;
    private int maxFrontierSize;
    private double executionTimeMs;
    private int pathLength;
    private double pathCost;

    public ExecutionMetrics() {}

    public ExecutionMetrics(int nodesVisited, int maxFrontierSize, double executionTimeMs, int pathLength, double pathCost) {
        this.nodesVisited = nodesVisited;
        this.maxFrontierSize = maxFrontierSize;
        this.executionTimeMs = executionTimeMs;
        this.pathLength = pathLength;
        this.pathCost = pathCost;
    }

    public int getNodesVisited() { return nodesVisited; }
    public void setNodesVisited(int nodesVisited) { this.nodesVisited = nodesVisited; }

    public int getMaxFrontierSize() { return maxFrontierSize; }
    public void setMaxFrontierSize(int maxFrontierSize) { this.maxFrontierSize = maxFrontierSize; }

    public double getExecutionTimeMs() { return executionTimeMs; }
    public void setExecutionTimeMs(double executionTimeMs) { this.executionTimeMs = executionTimeMs; }

    public int getPathLength() { return pathLength; }
    public void setPathLength(int pathLength) { this.pathLength = pathLength; }

    public double getPathCost() { return pathCost; }
    public void setPathCost(double pathCost) { this.pathCost = pathCost; }
}
