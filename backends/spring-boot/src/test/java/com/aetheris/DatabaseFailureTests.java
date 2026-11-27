package com.aetheris;

import com.aetheris.config.PersistenceConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class DatabaseFailureTests {

    @Test
    public void mongodbUnavailableReturns503WhilePathfindingRemains200() throws Exception {
        SpringApplication app = new SpringApplication(AetherisApplication.class);
        app.setDefaultProperties(Map.of(
                "server.port", "0",
                "aetheris.persistence.engine", "MONGODB",
                "aetheris.persistence.mongodb.uri", "mongodb://127.0.0.1:59999/aetheris",
                "aetheris.persistence.mongodb.database", "aetheris",
                "aetheris.persistence.mongodb.connect-timeout-ms", "500"
        ));

        try (ConfigurableApplicationContext ctx = app.run()) {
            MockMvc mockMvc = MockMvcBuilders.webAppContextSetup((WebApplicationContext) ctx).build();

            mockMvc.perform(get("/api/v1/health"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.persistenceEngine").value("MONGODB"))
                    .andExpect(jsonPath("$.persistenceStatus").value("UNAVAILABLE"))
                    .andExpect(jsonPath("$.databaseConnected").value(false));

            mockMvc.perform(get("/api/v1/health/ready"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("UP"));

            mockMvc.perform(post("/api/v1/pathfinding/trace")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\"}}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.pathFound").value(true));

            mockMvc.perform(get("/api/v1/presets"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")))
                    .andExpect(jsonPath("$.status").value(503));
        }
    }

    @Test
    public void invalidPersistenceEngineIsRejectedExplicitly() {
        PersistenceConfig config = new PersistenceConfig();
        ObjectProvider empty = new EmptyObjectProvider<>();
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> config.presetRepositoryPort("POSTGRES", empty, empty, empty, empty)
        );
        assertTrue(ex.getMessage().contains("Unsupported AETHERIS_PERSISTENCE_ENGINE"));
    }

    private static final class EmptyObjectProvider<T> implements ObjectProvider<T> {
        @Override public T getObject(Object... args) { return null; }
        @Override public T getIfAvailable() { return null; }
        @Override public T getIfUnique() { return null; }
        @Override public T getObject() { return null; }
    }
}
