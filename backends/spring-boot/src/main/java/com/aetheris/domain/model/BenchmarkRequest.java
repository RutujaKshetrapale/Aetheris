package com.aetheris.domain.model;

public class BenchmarkRequest {
    private String name;
    private String presetId;
    private AlgorithmType algorithm;
    private HeuristicType heuristic = HeuristicType.MANHATTAN;
    private GridModel grid;

    public BenchmarkRequest() {}

    public BenchmarkRequest(String name, String presetId, AlgorithmType algorithm, HeuristicType heuristic, GridModel grid) {
        this.name = name;
        this.presetId = presetId;
        this.algorithm = algorithm;
        this.heuristic = heuristic != null ? heuristic : HeuristicType.MANHATTAN;
        this.grid = grid;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPresetId() { return presetId; }
    public void setPresetId(String presetId) { this.presetId = presetId; }

    public AlgorithmType getAlgorithm() { return algorithm; }
    public void setAlgorithm(AlgorithmType algorithm) { this.algorithm = algorithm; }

    public HeuristicType getHeuristic() { return heuristic; }
    public void setHeuristic(HeuristicType heuristic) { this.heuristic = heuristic; }

    public GridModel getGrid() { return grid; }
    public void setGrid(GridModel grid) { this.grid = grid; }
}
