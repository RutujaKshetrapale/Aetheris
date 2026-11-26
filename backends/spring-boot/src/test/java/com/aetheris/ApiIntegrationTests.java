package com.aetheris;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.support.DirtiesContextTestExecutionListener;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@TestExecutionListeners(listeners = {
        DependencyInjectionTestExecutionListener.class,
        DirtiesContextTestExecutionListener.class
})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class ApiIntegrationTests {

    @Autowired
    private WebApplicationContext wac;

    private MockMvc mockMvc;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    public void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    @Test
    public void healthEndpointsReportHonestInMemoryState() throws Exception {
        mockMvc.perform(get("/api/v1/health/live"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/api/v1/health/ready"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        MvcResult res = mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.engineStatus").value("UP"))
                .andExpect(jsonPath("$.persistenceEngine").value("IN_MEMORY"))
                .andExpect(jsonPath("$.persistenceStatus").value("UP"))
                .andExpect(jsonPath("$.databaseConnected").value(false))
                .andReturn();

        JsonNode body = mapper.readTree(res.getResponse().getContentAsString());
        assertFalse(body.get("databaseConnected").asBoolean());
    }

    @Test
    public void pathfindingAllFourAlgorithmsAndEdgeCases() throws Exception {
        String gridJson = """
                {
                  "rows": 5,
                  "cols": 5,
                  "startNode": "r0c0",
                  "targetNode": "r4c4",
                  "cells": [
                    {"id":"r0c0","row":0,"col":0,"cellType":"START","weight":1},
                    {"id":"r4c4","row":4,"col":4,"cellType":"TARGET","weight":1},
                    {"id":"r1c2","row":1,"col":2,"cellType":"WALL","weight":1},
                    {"id":"r2c2","row":2,"col":2,"cellType":"WALL","weight":1},
                    {"id":"r3c2","row":3,"col":2,"cellType":"WALL","weight":1},
                    {"id":"r0c2","row":0,"col":2,"cellType":"WEIGHTED","weight":5}
                  ]
                }
                """;

        for (String algo : List.of("BFS", "DFS", "DIJKSTRA", "ASTAR")) {
            String payload = "{\"algorithm\":\"" + algo + "\",\"grid\":" + gridJson + "}";
            MvcResult res = mockMvc.perform(post("/api/v1/pathfinding/trace")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode root = mapper.readTree(res.getResponse().getContentAsString());
            assertEquals(algo, root.get("algorithm").asText());
            assertTrue(root.get("pathFound").asBoolean());
            assertTrue(root.get("traceDeltas").size() > 0);
            assertTrue(root.get("keyframes").size() > 0);
        }

        // Start equals target -> 200 single node path
        String sameNode = """
                {"algorithm":"ASTAR","grid":{"rows":3,"cols":3,"startNode":"r1c1","targetNode":"r1c1","cells":[]}}
                """;
        mockMvc.perform(post("/api/v1/pathfinding/trace")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sameNode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pathFound").value(true))
                .andExpect(jsonPath("$.pathNodeCount").value(1))
                .andExpect(jsonPath("$.pathEdgeCount").value(0))
                .andExpect(jsonPath("$.algorithmPathCost").value(0));

        // Unreachable target -> 200 empty path + FRONTIER_EXHAUSTED
        String blocked = """
                {
                  "algorithm":"BFS",
                  "grid":{
                    "rows":3,"cols":3,"startNode":"r0c0","targetNode":"r2c2",
                    "cells":[
                      {"id":"r0c1","row":0,"col":1,"cellType":"WALL","weight":1},
                      {"id":"r1c0","row":1,"col":0,"cellType":"WALL","weight":1}
                    ]
                  }
                }
                """;
        mockMvc.perform(post("/api/v1/pathfinding/trace")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(blocked))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pathFound").value(false))
                .andExpect(jsonPath("$.pathNodeCount").value(0))
                .andExpect(jsonPath("$.noPathReason").value("FRONTIER_EXHAUSTED"));
    }

    @Test
    public void pathfindingValidationErrorsReturnRfc9457() throws Exception {
        // Malformed JSON -> 400
        mockMvc.perform(post("/api/v1/pathfinding/trace")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{bad-json"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").isNotEmpty());

        // Invalid algorithm enum -> 400
        mockMvc.perform(post("/api/v1/pathfinding/trace")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"UNKNOWN\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")))
                .andExpect(jsonPath("$.status").value(400));

        // Out of bounds domain coordinates -> 422
        mockMvc.perform(post("/api/v1/pathfinding/trace")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r9c9\"}}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")))
                .andExpect(jsonPath("$.status").value(422));

        // Wall placed on startNode -> 422
        mockMvc.perform(post("/api/v1/pathfinding/trace")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\",\"cells\":[{\"id\":\"r0c0\",\"row\":0,\"col\":0,\"cellType\":\"WALL\",\"weight\":1}]}}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")))
                .andExpect(jsonPath("$.status").value(422));
    }

    @Test
    public void presetCrudAndPortableExportImport() throws Exception {
        String createPayload = """
                {
                  "id": "preset-test-phase3",
                  "name": "Phase 3 Test Grid",
                  "description": "Integration test preset",
                  "grid": {
                    "rows": 4,
                    "cols": 4,
                    "startNode": "r0c0",
                    "targetNode": "r3c3",
                    "cells": [
                      {"id":"r1c1","row":1,"col":1,"cellType":"WALL","weight":1},
                      {"id":"r2c2","row":2,"col":2,"cellType":"WEIGHTED","weight":8}
                    ]
                  }
                }
                """;

        // Create -> 201
        mockMvc.perform(post("/api/v1/presets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("preset-test-phase3"));

        // Duplicate -> 409
        mockMvc.perform(post("/api/v1/presets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createPayload))
                .andExpect(status().isConflict())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")));

        // Get -> 200
        mockMvc.perform(get("/api/v1/presets/preset-test-phase3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Phase 3 Test Grid"));

        // Update -> 200
        String updatePayload = createPayload.replace("Phase 3 Test Grid", "Phase 3 Updated Grid");
        mockMvc.perform(put("/api/v1/presets/preset-test-phase3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updatePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Phase 3 Updated Grid"));

        // Export -> canonical UTF-8 no BOM, LF only, sorted keys, 2-space indent
        MvcResult exportRes = mockMvc.perform(post("/api/v1/presets/export")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"presetIds\":[\"preset-test-phase3\"]}"))
                .andExpect(status().isOk())
                .andReturn();

        byte[] rawExport = exportRes.getResponse().getContentAsByteArray();
        assertFalse(rawExport.length >= 3 && (rawExport[0] & 0xFF) == 0xEF && (rawExport[1] & 0xFF) == 0xBB && (rawExport[2] & 0xFF) == 0xBF,
                "Export must not have UTF-8 BOM");
        String exportText = new String(rawExport, StandardCharsets.UTF_8);
        assertFalse(exportText.contains("\r\n"), "Export must use LF line endings only");
        assertTrue(exportText.contains("\n  \"format\": \"aetheris-preset-bundle\""), "Export must use 2-space indentation");

        JsonNode bundleNode = mapper.readTree(exportText);
        Iterator<String> fieldNames = bundleNode.fieldNames();
        String prev = "";
        while (fieldNames.hasNext()) {
            String key = fieldNames.next();
            assertTrue(prev.compareTo(key) < 0, "Keys must be lexicographically sorted: " + prev + " vs " + key);
            prev = key;
        }

        // Delete -> 204, then Get -> 404
        mockMvc.perform(delete("/api/v1/presets/preset-test-phase3"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/presets/preset-test-phase3"))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")));

        // Re-import exported bundle -> 200 and restored
        mockMvc.perform(post("/api/v1/presets/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(rawExport))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.importedCount").value(1));

        mockMvc.perform(get("/api/v1/presets/preset-test-phase3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Phase 3 Updated Grid"));

        // Tampered contentHash -> 422
        String tampered = exportText.replace("Phase 3 Updated Grid", "Tampered Name");
        mockMvc.perform(post("/api/v1/presets/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tampered))
                .andExpect(status().isUnprocessableContent())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")));

        // Clean up
        mockMvc.perform(delete("/api/v1/presets/preset-test-phase3"))
                .andExpect(status().isNoContent());
    }

    @Test
    public void benchmarkCreateAndRetrieveAndValidation() throws Exception {
        String benchmarkPayload = """
                {
                  "name": "Dijkstra 5x5 Benchmark",
                  "algorithm": "DIJKSTRA",
                  "grid": {
                    "rows": 5,
                    "cols": 5,
                    "startNode": "r0c0",
                    "targetNode": "r4c4",
                    "cells": [
                      {"id":"r1c2","row":1,"col":2,"cellType":"WALL","weight":1},
                      {"id":"r0c2","row":0,"col":2,"cellType":"WEIGHTED","weight":5}
                    ]
                  }
                }
                """;

        MvcResult res = mockMvc.perform(post("/api/v1/benchmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(benchmarkPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.algorithm").value("DIJKSTRA"))
                .andExpect(jsonPath("$.gridRows").value(5))
                .andExpect(jsonPath("$.gridCols").value(5))
                .andExpect(jsonPath("$.pathFound").value(true))
                .andReturn();

        JsonNode created = mapper.readTree(res.getResponse().getContentAsString());
        assertFalse(created.has("traceDeltas"), "Benchmark record must not persist individual trace events");
        String id = created.get("id").asText();
        assertNotNull(id);

        mockMvc.perform(get("/api/v1/benchmarks/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.algorithm").value("DIJKSTRA"));

        mockMvc.perform(get("/api/v1/benchmarks/bench-does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")));

        // Invalid benchmark request -> 400
        mockMvc.perform(post("/api/v1/benchmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"BFS\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")));
    }

    @Test
    public void corsAllowsReactDevOrigin3100() throws Exception {
        mockMvc.perform(options("/api/v1/pathfinding/trace")
                        .header("Origin", "http://localhost:3100")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Origin"));
    }
}
