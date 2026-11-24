package com.aetheris;

import com.aetheris.algorithm.PathfindingEngine;
import com.aetheris.domain.model.AlgorithmType;
import com.aetheris.domain.model.GridModel;
import com.aetheris.domain.model.PathfindingRequest;
import com.aetheris.domain.model.PathfindingResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

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
        // Look in contracts/fixtures
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

    @Test
    @DisplayName("Verify Spring Boot BFS produces identical output to canonical fixture")
    public void testBfsFixture() throws IOException {
        JsonNode fixture = loadFixture("bfs.fixture.json");
        GridModel grid = objectMapper.treeToValue(fixture.get("grid"), GridModel.class);

        PathfindingRequest request = new PathfindingRequest(AlgorithmType.BFS, grid);
        PathfindingResponse response = engine.execute(request);

        JsonNode expected = fixture.get("expectedOutcome");
        assertTrue(response.isPathFound(), "BFS must find a path");

        List<String> expectedPath = new ArrayList<>();
        expected.get("path").forEach(node -> expectedPath.add(node.asText()));

        assertEquals(expectedPath, response.getPath(), "BFS path must exactly match canonical fixture");
        assertEquals(expected.get("pathCost").asDouble(), response.getPathCost(), 1e-6, "BFS path cost must match");
        assertEquals(expected.get("pathLength").asInt(), response.getPath().size(), "BFS path length must match");
        assertEquals(expected.get("nodesVisited").asInt(), response.getMetrics().getNodesVisited(), "BFS visited node count must match");
        assertEquals(expected.get("totalTraceDeltas").asInt(), response.getTraceDeltas().size(), "BFS total trace delta count must match");
    }

    @Test
    @DisplayName("Verify Spring Boot DFS produces identical output to canonical fixture")
    public void testDfsFixture() throws IOException {
        JsonNode fixture = loadFixture("dfs.fixture.json");
        GridModel grid = objectMapper.treeToValue(fixture.get("grid"), GridModel.class);

        PathfindingRequest request = new PathfindingRequest(AlgorithmType.DFS, grid);
        PathfindingResponse response = engine.execute(request);

        JsonNode expected = fixture.get("expectedOutcome");
        assertTrue(response.isPathFound(), "DFS must find a path");

        List<String> expectedPath = new ArrayList<>();
        expected.get("path").forEach(node -> expectedPath.add(node.asText()));

        assertEquals(expectedPath, response.getPath(), "DFS path must exactly match canonical fixture");
        assertEquals(expected.get("pathCost").asDouble(), response.getPathCost(), 1e-6, "DFS path cost must match");
        assertEquals(expected.get("pathLength").asInt(), response.getPath().size(), "DFS path length must match");
        assertEquals(expected.get("nodesVisited").asInt(), response.getMetrics().getNodesVisited(), "DFS visited node count must match");
        assertEquals(expected.get("totalTraceDeltas").asInt(), response.getTraceDeltas().size(), "DFS total trace delta count must match");
    }

    @Test
    @DisplayName("Verify Spring Boot Dijkstra produces identical output to canonical fixture")
    public void testDijkstraFixture() throws IOException {
        JsonNode fixture = loadFixture("dijkstra.fixture.json");
        GridModel grid = objectMapper.treeToValue(fixture.get("grid"), GridModel.class);

        PathfindingRequest request = new PathfindingRequest(AlgorithmType.DIJKSTRA, grid);
        PathfindingResponse response = engine.execute(request);

        JsonNode expected = fixture.get("expectedOutcome");
        assertTrue(response.isPathFound(), "Dijkstra must find a path");

        List<String> expectedPath = new ArrayList<>();
        expected.get("path").forEach(node -> expectedPath.add(node.asText()));

        assertEquals(expectedPath, response.getPath(), "Dijkstra path must exactly match canonical fixture");
        assertEquals(expected.get("pathCost").asDouble(), response.getPathCost(), 1e-6, "Dijkstra path cost must match");
        assertEquals(expected.get("pathLength").asInt(), response.getPath().size(), "Dijkstra path length must match");
        assertEquals(expected.get("nodesVisited").asInt(), response.getMetrics().getNodesVisited(), "Dijkstra visited node count must match");
        assertEquals(expected.get("totalTraceDeltas").asInt(), response.getTraceDeltas().size(), "Dijkstra total trace delta count must match");
    }

    @Test
    @DisplayName("Verify Spring Boot A* produces identical output to canonical fixture")
    public void testAStarFixture() throws IOException {
        JsonNode fixture = loadFixture("astar.fixture.json");
        GridModel grid = objectMapper.treeToValue(fixture.get("grid"), GridModel.class);

        PathfindingRequest request = new PathfindingRequest(AlgorithmType.ASTAR, grid);
        PathfindingResponse response = engine.execute(request);

        JsonNode expected = fixture.get("expectedOutcome");
        assertTrue(response.isPathFound(), "A* must find a path");

        List<String> expectedPath = new ArrayList<>();
        expected.get("path").forEach(node -> expectedPath.add(node.asText()));

        assertEquals(expectedPath, response.getPath(), "A* path must exactly match canonical fixture");
        assertEquals(expected.get("pathCost").asDouble(), response.getPathCost(), 1e-6, "A* path cost must match");
        assertEquals(expected.get("pathLength").asInt(), response.getPath().size(), "A* path length must match");
        assertEquals(expected.get("nodesVisited").asInt(), response.getMetrics().getNodesVisited(), "A* visited node count must match");
        assertEquals(expected.get("totalTraceDeltas").asInt(), response.getTraceDeltas().size(), "A* total trace delta count must match");
    }
}
