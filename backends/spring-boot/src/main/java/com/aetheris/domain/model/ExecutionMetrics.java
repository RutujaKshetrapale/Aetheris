package com.aetheris.domain.model;

public class ExecutionMetrics {
    private int pathNodeCount;
    private int pathEdgeCount;
    private Integer algorithmPathCost;
    private Integer terrainPathCost;
    private int nodesVisited;
    private int maxFrontierSize;
    private double executionTimeMs;
    private int totalSteps;

    public ExecutionMetrics() {}

    public ExecutionMetrics(int pathNodeCount, int pathEdgeCount, Integer algorithmPathCost, Integer terrainPathCost,
                            int nodesVisited, int maxFrontierSize, double executionTimeMs, int totalSteps) {
        this.pathNodeCount = pathNodeCount;
        this.pathEdgeCount = pathEdgeCount;
        this.algorithmPathCost = algorithmPathCost;
        this.terrainPathCost = terrainPathCost;
        this.nodesVisited = nodesVisited;
        this.maxFrontierSize = maxFrontierSize;
        this.executionTimeMs = executionTimeMs;
        this.totalSteps = totalSteps;
    }

    public int getPathNodeCount() { return pathNodeCount; }
    public void setPathNodeCount(int pathNodeCount) { this.pathNodeCount = pathNodeCount; }

    public int getPathEdgeCount() { return pathEdgeCount; }
    public void setPathEdgeCount(int pathEdgeCount) { this.pathEdgeCount = pathEdgeCount; }

    public Integer getAlgorithmPathCost() { return algorithmPathCost; }
    public void setAlgorithmPathCost(Integer algorithmPathCost) { this.algorithmPathCost = algorithmPathCost; }

    public Integer getTerrainPathCost() { return terrainPathCost; }
    public void setTerrainPathCost(Integer terrainPathCost) { this.terrainPathCost = terrainPathCost; }

    public int getNodesVisited() { return nodesVisited; }
    public void setNodesVisited(int nodesVisited) { this.nodesVisited = nodesVisited; }

    public int getMaxFrontierSize() { return maxFrontierSize; }
    public void setMaxFrontierSize(int maxFrontierSize) { this.maxFrontierSize = maxFrontierSize; }

    public double getExecutionTimeMs() { return executionTimeMs; }
    public void setExecutionTimeMs(double executionTimeMs) { this.executionTimeMs = executionTimeMs; }

    public int getTotalSteps() { return totalSteps; }
    public void setTotalSteps(int totalSteps) { this.totalSteps = totalSteps; }
}
