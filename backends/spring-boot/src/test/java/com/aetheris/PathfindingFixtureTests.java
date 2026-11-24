package com.aetheris;

import com.aetheris.algorithm.PathfindingEngine;
import com.aetheris.domain.model.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class PathfindingFixtureTests {

    private PathfindingEngine engine;
    private ObjectMapper objectMapper;

    @BeforeEach
    public void setup() {
        engine = new PathfindingEngine();
        objectMapper = new ObjectMapper();
    }

    private JsonNode loadFixture(String filename) throws IOException {
        File file = new File("../../contracts/fixtures/" + filename);
        if (!file.exists()) {
            file = new File("contracts/fixtures/" + filename);
        }
        if (!file.exists()) {
            file = new File("../contracts/fixtures/" + filename);
        }
        assertTrue(file.exists(), "Fixture file must exist at " + file.getAbsolutePath());
        return objectMapper.readTree(file);
    }

    private void verifyFixture(String filename, AlgorithmType expectedAlgo) throws IOException {
        JsonNode fixture = loadFixture(filename);
        GridModel grid = objectMapper.treeToValue(fixture.get("grid"), GridModel.class);

        PathfindingRequest request = new PathfindingRequest(expectedAlgo, grid);
        PathfindingResponse response = engine.execute(request);

        JsonNode expected = fixture.get("expectedOutcome");
        boolean expectedPathFound = expected.get("pathFound").asBoolean();
        assertEquals(expectedPathFound, response.isPathFound(), filename + " pathFound mismatch");

        List<String> expectedPath = new ArrayList<>();
        expected.get("path").forEach(node -> expectedPath.add(node.asText()));
        assertEquals(expectedPath, response.getPath(), filename + " path mismatch");

        assertEquals(expected.get("pathNodeCount").asInt(), response.getPathNodeCount(), filename + " pathNodeCount mismatch");
        assertEquals(expected.get("pathEdgeCount").asInt(), response.getPathEdgeCount(), filename + " pathEdgeCount mismatch");

        if (expected.get("algorithmPathCost").isNull()) {
            assertNull(response.getAlgorithmPathCost(), filename + " algorithmPathCost should be null");
        } else {
            assertEquals(expected.get("algorithmPathCost").asInt(), response.getAlgorithmPathCost().intValue(), filename + " algorithmPathCost mismatch");
        }

        if (expected.get("terrainPathCost").isNull()) {
            assertNull(response.getTerrainPathCost(), filename + " terrainPathCost should be null");
        } else {
            assertEquals(expected.get("terrainPathCost").asInt(), response.getTerrainPathCost().intValue(), filename + " terrainPathCost mismatch");
        }

        assertEquals(expected.get("nodesVisited").asInt(), response.getMetrics().getNodesVisited(), filename + " nodesVisited mismatch");
        assertEquals(expected.get("totalSteps").asInt(), response.getTraceDeltas().size(), filename + " totalSteps mismatch");

        if (expected.get("noPathReason").isNull()) {
            assertNull(response.getNoPathReason(), filename + " noPathReason should be null");
        } else {
            assertEquals(expected.get("noPathReason").asText(), response.getNoPathReason(), filename + " noPathReason mismatch");
        }

        // Full Reversibility Verification:
        // 1. Build initial grid state map
        Map<String, CellState> stateMap = new HashMap<>();
        for (int r = 0; r < grid.getRows(); r++) {
            for (int c = 0; c < grid.getCols(); c++) {
                String id = "r" + r + "c" + c;
                CellType ct = CellType.EMPTY;
                if (id.equals(grid.getTargetNode())) ct = CellType.TARGET;
                if (id.equals(grid.getStartNode())) ct = CellType.START;
                if (grid.getCells() != null) {
                    for (CellDefinition cd : grid.getCells()) {
                        if (cd.getId().equals(id)) {
                            ct = cd.getCellType();
                            break;
                        }
                    }
                }
                stateMap.put(id, new CellState(ct, TraversalState.UNVISITED, false, null, null, null, null));
            }
        }

        // Deep clone initial snapshots
        Map<String, CellState> initialSnapshots = new HashMap<>();
        for (Map.Entry<String, CellState> entry : stateMap.entrySet()) {
            initialSnapshots.put(entry.getKey(), entry.getValue().copy());
        }

        // Apply deltas forward
        for (TraceDelta delta : response.getTraceDeltas()) {
            if (delta.getNodeId() != null && delta.getAfterState() != null) {
                stateMap.put(delta.getNodeId(), delta.getAfterState().copy());
            }
        }

        // Check path overlay in final state
        for (String pId : response.getPath()) {
            CellState s = stateMap.get(pId);
            assertNotNull(s, "Path node " + pId + " must exist");
            assertTrue(s.isInPath(), "Path node " + pId + " must be marked inPath");
        }

        // Apply deltas backward
        for (int i = response.getTraceDeltas().size() - 1; i >= 0; i--) {
            TraceDelta delta = response.getTraceDeltas().get(i);
            if (delta.getNodeId() != null && delta.getBeforeState() != null) {
                stateMap.put(delta.getNodeId(), delta.getBeforeState().copy());
            }
        }

        // Verify exact restoration to initial state
        for (Map.Entry<String, CellState> entry : initialSnapshots.entrySet()) {
            CellState initial = entry.getValue();
            CellState restored = stateMap.get(entry.getKey());
            assertEquals(initial.getCellType(), restored.getCellType(), "CellType restoration failed for " + entry.getKey());
            assertEquals(initial.getTraversalState(), restored.getTraversalState(), "TraversalState restoration failed for " + entry.getKey());
            assertEquals(initial.isInPath(), restored.isInPath(), "inPath restoration failed for " + entry.getKey());
            assertEquals(initial.getGCost(), restored.getGCost(), "gCost restoration failed for " + entry.getKey());
            assertEquals(initial.getHCost(), restored.getHCost(), "hCost restoration failed for " + entry.getKey());
            assertEquals(initial.getFCost(), restored.getFCost(), "fCost restoration failed for " + entry.getKey());
            assertEquals(initial.getParentId(), restored.getParentId(), "parentId restoration failed for " + entry.getKey());
        }
    }

    @Test
    @DisplayName("Verify Spring Boot BFS matches canonical fixture")
    public void testBfsFixture() throws IOException {
        verifyFixture("bfs.fixture.json", AlgorithmType.BFS);
    }

    @Test
    @DisplayName("Verify Spring Boot DFS matches canonical fixture")
    public void testDfsFixture() throws IOException {
        verifyFixture("dfs.fixture.json", AlgorithmType.DFS);
    }

    @Test
    @DisplayName("Verify Spring Boot Dijkstra matches canonical fixture")
    public void testDijkstraFixture() throws IOException {
        verifyFixture("dijkstra.fixture.json", AlgorithmType.DIJKSTRA);
    }

    @Test
    @DisplayName("Verify Spring Boot A* matches canonical fixture")
    public void testAstarFixture() throws IOException {
        verifyFixture("astar.fixture.json", AlgorithmType.ASTAR);
    }

    @Test
    @DisplayName("Verify Spring Boot Start Equals Target special case matches canonical fixture")
    public void testStartEqualsTargetFixture() throws IOException {
        verifyFixture("start-equals-target.fixture.json", AlgorithmType.DIJKSTRA);
    }

    @Test
    @DisplayName("Verify Spring Boot Unreachable Target special case matches canonical fixture")
    public void testUnreachableTargetFixture() throws IOException {
        verifyFixture("unreachable-target.fixture.json", AlgorithmType.BFS);
    }
}
