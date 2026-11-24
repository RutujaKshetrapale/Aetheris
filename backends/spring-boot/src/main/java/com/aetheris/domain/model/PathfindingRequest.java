package com.aetheris.domain.model;

public class PathfindingRequest {
    private AlgorithmType algorithm;
    private GridModel grid;
    private HeuristicType heuristic = HeuristicType.MANHATTAN;
    private boolean allowDiagonals = false;

    public PathfindingRequest() {}

    public PathfindingRequest(AlgorithmType algorithm, GridModel grid) {
        this.algorithm = algorithm;
        this.grid = grid;
    }

    public AlgorithmType getAlgorithm() { return algorithm; }
    public void setAlgorithm(AlgorithmType algorithm) { this.algorithm = algorithm; }

    public GridModel getGrid() { return grid; }
    public void setGrid(GridModel grid) { this.grid = grid; }

    public HeuristicType getHeuristic() { return heuristic; }
    public void setHeuristic(HeuristicType heuristic) { this.heuristic = heuristic; }

    public boolean isAllowDiagonals() { return allowDiagonals; }
    public void setAllowDiagonals(boolean allowDiagonals) { this.allowDiagonals = allowDiagonals; }
}
