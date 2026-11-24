package com.aetheris.domain.model;

import java.util.ArrayList;
import java.util.List;

public class PathfindingResponse {
    private AlgorithmType algorithm;
    private boolean pathFound;
    private List<String> path = new ArrayList<>();
    private int pathNodeCount;
    private int pathEdgeCount;
    private Integer algorithmPathCost;
    private Integer terrainPathCost;
    private List<TraceDelta> traceDeltas = new ArrayList<>();
    private List<Keyframe> keyframes = new ArrayList<>();
    private ExecutionMetrics metrics;
    private boolean reversible = true;
    private String noPathReason;

    public PathfindingResponse() {}

    public AlgorithmType getAlgorithm() { return algorithm; }
    public void setAlgorithm(AlgorithmType algorithm) { this.algorithm = algorithm; }

    public boolean isPathFound() { return pathFound; }
    public void setPathFound(boolean pathFound) { this.pathFound = pathFound; }

    public List<String> getPath() { return path; }
    public void setPath(List<String> path) { this.path = path; }

    public int getPathNodeCount() { return pathNodeCount; }
    public void setPathNodeCount(int pathNodeCount) { this.pathNodeCount = pathNodeCount; }

    public int getPathEdgeCount() { return pathEdgeCount; }
    public void setPathEdgeCount(int pathEdgeCount) { this.pathEdgeCount = pathEdgeCount; }

    public Integer getAlgorithmPathCost() { return algorithmPathCost; }
    public void setAlgorithmPathCost(Integer algorithmPathCost) { this.algorithmPathCost = algorithmPathCost; }

    public Integer getTerrainPathCost() { return terrainPathCost; }
    public void setTerrainPathCost(Integer terrainPathCost) { this.terrainPathCost = terrainPathCost; }

    public List<TraceDelta> getTraceDeltas() { return traceDeltas; }
    public void setTraceDeltas(List<TraceDelta> traceDeltas) { this.traceDeltas = traceDeltas; }

    public List<Keyframe> getKeyframes() { return keyframes; }
    public void setKeyframes(List<Keyframe> keyframes) { this.keyframes = keyframes; }

    public ExecutionMetrics getMetrics() { return metrics; }
    public void setMetrics(ExecutionMetrics metrics) { this.metrics = metrics; }

    public boolean isReversible() { return reversible; }
    public void setReversible(boolean reversible) { this.reversible = reversible; }

    public String getNoPathReason() { return noPathReason; }
    public void setNoPathReason(String noPathReason) { this.noPathReason = noPathReason; }
}
