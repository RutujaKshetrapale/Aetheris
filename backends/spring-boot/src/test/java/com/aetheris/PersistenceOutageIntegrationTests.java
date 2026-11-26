package com.aetheris;

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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {"aetheris.persistence.engine=MYSQL"}
)
@TestExecutionListeners(listeners = {
        DependencyInjectionTestExecutionListener.class,
        DirtiesContextTestExecutionListener.class
})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class PersistenceOutageIntegrationTests {

    @Autowired
    private WebApplicationContext wac;

    private MockMvc mockMvc;

    @BeforeEach
    public void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    @Test
    public void pathfindingAndReadinessStayOperationalWhenPersistenceUnavailable() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.engineStatus").value("UP"))
                .andExpect(jsonPath("$.persistenceEngine").value("MYSQL"))
                .andExpect(jsonPath("$.persistenceStatus").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.databaseConnected").value(false));

        mockMvc.perform(get("/api/v1/health/ready"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        // Core pathfinding remains 200 OK
        mockMvc.perform(post("/api/v1/pathfinding/trace")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pathFound").value(true));

        // Persistence-dependent endpoints return 503 ProblemDetails
        mockMvc.perform(get("/api/v1/presets"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")))
                .andExpect(jsonPath("$.status").value(503));

        mockMvc.perform(post("/api/v1/benchmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\"}}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/problem+json")))
                .andExpect(jsonPath("$.status").value(503));
    }
}
