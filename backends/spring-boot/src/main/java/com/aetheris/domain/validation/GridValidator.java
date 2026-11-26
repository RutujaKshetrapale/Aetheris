package com.aetheris.domain.validation;

import com.aetheris.algorithm.NodeIdUtil;
import com.aetheris.domain.exception.DomainValidationException;
import com.aetheris.domain.exception.SchemaValidationException;
import com.aetheris.domain.model.*;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

public final class GridValidator {

    private static final Pattern RESOURCE_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$");
    private static final Pattern NODE_ID_PATTERN = Pattern.compile("^r[0-9]+c[0-9]+$");

    private GridValidator() {}

    public static void validateResourceId(String id, String resourceName) {
        if (id == null || id.isBlank() || !RESOURCE_ID_PATTERN.matcher(id).matches()) {
            throw new SchemaValidationException(
                    resourceName + " ID must be 1-64 alphanumeric, dot, underscore, or hyphen characters.",
                    Map.of("field", "id", "rule", "pattern")
            );
        }
    }

    public static void validatePathfindingRequest(PathfindingRequest request) {
        if (request == null) {
            throw new SchemaValidationException("Pathfinding request cannot be null");
        }
        if (request.getAlgorithm() == null) {
            throw new SchemaValidationException("Algorithm must be specified", Map.of("field", "algorithm"));
        }
        if (request.getHeuristic() == null) {
            request.setHeuristic(HeuristicType.MANHATTAN);
        }
        validateGrid(request.getGrid());
    }

    public static void validateGrid(GridModel grid) {
        if (grid == null) {
            throw new SchemaValidationException("Grid model cannot be null", Map.of("field", "grid"));
        }
        int rows = grid.getRows();
        int cols = grid.getCols();
        if (rows < 1 || cols < 1 || rows > 200 || cols > 200) {
            throw new SchemaValidationException(
                    "Grid dimensions must be integers between 1 and 200: rows=" + rows + ", cols=" + cols,
                    Map.of("rows", rows, "cols", cols)
            );
        }
        String startNode = grid.getStartNode();
        String targetNode = grid.getTargetNode();
        if (startNode == null || startNode.isBlank() || targetNode == null || targetNode.isBlank()) {
            throw new SchemaValidationException("Start node and target node are required");
        }
        if (!NODE_ID_PATTERN.matcher(startNode).matches()) {
            throw new SchemaValidationException("Invalid startNode format: " + startNode, Map.of("field", "grid.startNode"));
        }
        if (!NODE_ID_PATTERN.matcher(targetNode).matches()) {
            throw new SchemaValidationException("Invalid targetNode format: " + targetNode, Map.of("field", "grid.targetNode"));
        }

        int[] startPos = parseCoordinatesOrSchemaFail(startNode, "grid.startNode");
        int[] targetPos = parseCoordinatesOrSchemaFail(targetNode, "grid.targetNode");

        // Schema checks on all cells first
        if (grid.getCells() != null) {
            for (int i = 0; i < grid.getCells().size(); i++) {
                CellDefinition cd = grid.getCells().get(i);
                if (cd == null || cd.getId() == null || cd.getCellType() == null) {
                    throw new SchemaValidationException("Cell definition must have id and cellType", Map.of("index", i));
                }
                if (!NODE_ID_PATTERN.matcher(cd.getId()).matches()) {
                    throw new SchemaValidationException("Invalid cell id format: " + cd.getId(), Map.of("cellId", cd.getId()));
                }
                if (cd.getRow() < 0 || cd.getCol() < 0) {
                    throw new SchemaValidationException("Cell row and col must be non-negative: " + cd.getId(), Map.of("cellId", cd.getId()));
                }
                if (cd.getWeight() < 1 || cd.getWeight() > 100) {
                    throw new SchemaValidationException("Cell weight must be between 1 and 100: " + cd.getId(), Map.of("cellId", cd.getId()));
                }
            }
        }

        // Domain checks (HTTP 422)
        if (startPos[0] < 0 || startPos[0] >= rows || startPos[1] < 0 || startPos[1] >= cols) {
            throw new DomainValidationException("Start node out of bounds: " + startNode, Map.of("nodeId", startNode, "rows", rows, "cols", cols));
        }
        if (targetPos[0] < 0 || targetPos[0] >= rows || targetPos[1] < 0 || targetPos[1] >= cols) {
            throw new DomainValidationException("Target node out of bounds: " + targetNode, Map.of("nodeId", targetNode, "rows", rows, "cols", cols));
        }

        if (grid.getCells() != null) {
            Set<String> seenIds = new HashSet<>();
            for (CellDefinition cd : grid.getCells()) {
                int[] pos = parseCoordinatesOrSchemaFail(cd.getId(), "grid.cells");
                if (pos[0] < 0 || pos[0] >= rows || pos[1] < 0 || pos[1] >= cols) {
                    throw new DomainValidationException("Cell " + cd.getId() + " out of bounds", Map.of("cellId", cd.getId(), "rows", rows, "cols", cols));
                }
                if (pos[0] != cd.getRow() || pos[1] != cd.getCol()) {
                    throw new DomainValidationException("Cell id does not match coordinates for " + cd.getId(), Map.of("cellId", cd.getId()));
                }
                if (!seenIds.add(cd.getId())) {
                    throw new DomainValidationException("Duplicate cell definition for " + cd.getId(), Map.of("cellId", cd.getId()));
                }
                if (cd.getCellType() == CellType.WEIGHTED && (cd.getWeight() < 2 || cd.getWeight() > 100)) {
                    throw new DomainValidationException("Weighted cell must have integer weight between 2 and 100: " + cd.getId(), Map.of("cellId", cd.getId(), "weight", cd.getWeight()));
                }
                if ((cd.getId().equals(startNode) || cd.getId().equals(targetNode)) && cd.getCellType() == CellType.WALL) {
                    throw new DomainValidationException("Start or target node cannot be a WALL: " + cd.getId(), Map.of("cellId", cd.getId()));
                }
                if (!startNode.equals(targetNode)) {
                    if (cd.getId().equals(startNode) && cd.getCellType() == CellType.TARGET) {
                        throw new DomainValidationException("Start node cannot be marked as TARGET: " + cd.getId(), Map.of("cellId", cd.getId()));
                    }
                    if (cd.getId().equals(targetNode) && cd.getCellType() == CellType.START) {
                        throw new DomainValidationException("Target node cannot be marked as START: " + cd.getId(), Map.of("cellId", cd.getId()));
                    }
                }
            }
        }
    }

    private static int[] parseCoordinatesOrSchemaFail(String nodeId, String field) {
        try {
            return NodeIdUtil.parse(nodeId);
        } catch (Exception e) {
            throw new SchemaValidationException("Invalid node id format: " + nodeId, Map.of("field", field));
        }
    }
}
