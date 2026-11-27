package com.aetheris.adapter.persistence.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "benchmarks")
public class BenchmarkDocument {

    @Id
    private String mongoId;

    @Field("id")
    @Indexed(unique = true)
    private String domainId;

    private String name;
    private String presetId;
    private String algorithm;
    private String heuristic;
    private int gridRows;
    private int gridCols;
    private String startNode;
    private String targetNode;
    private boolean pathFound;
    private int pathNodeCount;
    private int pathEdgeCount;
    private Integer algorithmPathCost;
    private Integer terrainPathCost;
    private int nodesVisited;
    private int maxFrontierSize;
    private int totalSteps;
    private double executionTimeMs;
    private String createdAt;

    public BenchmarkDocument() {}

    public String getMongoId() { return mongoId; }
    public void setMongoId(String mongoId) { this.mongoId = mongoId; }

    public String getDomainId() { return domainId; }
    public void setDomainId(String domainId) { this.domainId = domainId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPresetId() { return presetId; }
    public void setPresetId(String presetId) { this.presetId = presetId; }

    public String getAlgorithm() { return algorithm; }
    public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }

    public String getHeuristic() { return heuristic; }
    public void setHeuristic(String heuristic) { this.heuristic = heuristic; }

    public int getGridRows() { return gridRows; }
    public void setGridRows(int gridRows) { this.gridRows = gridRows; }

    public int getGridCols() { return gridCols; }
    public void setGridCols(int gridCols) { this.gridCols = gridCols; }

    public String getStartNode() { return startNode; }
    public void setStartNode(String startNode) { this.startNode = startNode; }

    public String getTargetNode() { return targetNode; }
    public void setTargetNode(String targetNode) { this.targetNode = targetNode; }

    public boolean isPathFound() { return pathFound; }
    public void setPathFound(boolean pathFound) { this.pathFound = pathFound; }

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

    public int getTotalSteps() { return totalSteps; }
    public void setTotalSteps(int totalSteps) { this.totalSteps = totalSteps; }

    public double getExecutionTimeMs() { return executionTimeMs; }
    public void setExecutionTimeMs(double executionTimeMs) { this.executionTimeMs = executionTimeMs; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
