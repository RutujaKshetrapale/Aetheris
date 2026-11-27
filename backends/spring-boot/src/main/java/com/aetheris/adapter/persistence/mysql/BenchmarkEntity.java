package com.aetheris.adapter.persistence.mysql;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "benchmarks")
public class BenchmarkEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "name", length = 255)
    private String name;

    @Column(name = "preset_id", length = 64)
    private String presetId;

    @Column(name = "algorithm", length = 16, nullable = false)
    private String algorithm;

    @Column(name = "heuristic", length = 16, nullable = false)
    private String heuristic;

    @Column(name = "grid_rows", nullable = false)
    private int gridRows;

    @Column(name = "grid_cols", nullable = false)
    private int gridCols;

    @Column(name = "start_node", length = 32, nullable = false)
    private String startNode;

    @Column(name = "target_node", length = 32, nullable = false)
    private String targetNode;

    @Column(name = "path_found", nullable = false)
    private boolean pathFound;

    @Column(name = "path_node_count", nullable = false)
    private int pathNodeCount;

    @Column(name = "path_edge_count", nullable = false)
    private int pathEdgeCount;

    @Column(name = "algorithm_path_cost")
    private Integer algorithmPathCost;

    @Column(name = "terrain_path_cost")
    private Integer terrainPathCost;

    @Column(name = "nodes_visited", nullable = false)
    private int nodesVisited;

    @Column(name = "max_frontier_size", nullable = false)
    private int maxFrontierSize;

    @Column(name = "total_steps", nullable = false)
    private int totalSteps;

    @Column(name = "execution_time_ms", nullable = false)
    private double executionTimeMs;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public BenchmarkEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

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

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
