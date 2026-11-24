package com.aetheris.domain.model;

public class AlgorithmInfo {
    private AlgorithmType id;
    private String name;
    private String description;
    private boolean weighted;
    private boolean guaranteedShortestPath;
    private String frontierType;

    public AlgorithmInfo() {}

    public AlgorithmInfo(AlgorithmType id, String name, String description, boolean weighted, boolean guaranteedShortestPath, String frontierType) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.weighted = weighted;
        this.guaranteedShortestPath = guaranteedShortestPath;
        this.frontierType = frontierType;
    }

    public AlgorithmType getId() { return id; }
    public void setId(AlgorithmType id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isWeighted() { return weighted; }
    public void setWeighted(boolean weighted) { this.weighted = weighted; }

    public boolean isGuaranteedShortestPath() { return guaranteedShortestPath; }
    public void setGuaranteedShortestPath(boolean guaranteedShortestPath) { this.guaranteedShortestPath = guaranteedShortestPath; }

    public String getFrontierType() { return frontierType; }
    public void setFrontierType(String frontierType) { this.frontierType = frontierType; }
}
