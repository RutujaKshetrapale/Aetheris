package com.aetheris;

import com.aetheris.adapter.persistence.MongoBenchmarkAdapter;
import com.aetheris.adapter.persistence.MongoPresetAdapter;
import com.aetheris.adapter.persistence.MySqlBenchmarkAdapter;
import com.aetheris.adapter.persistence.MySqlPresetAdapter;
import com.aetheris.adapter.persistence.mongo.MongoPersistenceConfig;
import com.aetheris.adapter.persistence.mysql.MySqlPersistenceConfig;
import com.aetheris.application.PresetBundleCodec;
import com.aetheris.domain.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

public class DatabaseAdapterTests {

    private static GridPreset samplePreset(String id) {
        List<CellDefinition> cells = List.of(
                new CellDefinition("r0c0", 0, 0, CellType.START, 1),
                new CellDefinition("r3c3", 3, 3, CellType.TARGET, 1),
                new CellDefinition("r1c1", 1, 1, CellType.WALL, 1),
                new CellDefinition("r0c2", 0, 2, CellType.WEIGHTED, 7)
        );
        GridModel grid = new GridModel(4, 4, "r0c0", "r3c3", cells);
        return new GridPreset(id, "Phase 4 Test Grid", "Adapter roundtrip grid", grid, Instant.now().toString());
    }

    private static BenchmarkRecord sampleBenchmark(String id, String presetId) {
        return new BenchmarkRecord(
                id,
                "Phase 4 Benchmark",
                presetId,
                AlgorithmType.DIJKSTRA,
                HeuristicType.MANHATTAN,
                4,
                4,
                "r0c0",
                "r3c3",
                true,
                7,
                6,
                12,
                12,
                9,
                4,
                28,
                1.25,
                Instant.now().toString()
        );
    }

    @Test
    public void mysqlAndMongoConfigValidationRejectsIncompleteSettings() {
        MySqlPersistenceConfig config = new MySqlPersistenceConfig();
        MySqlPersistenceConfig.MySqlHealthProbe invalidMysql =
                config.mysqlHealthProbe("", "", 3306, "", "", "", 1000);
        assertFalse(invalidMysql.configValid());
        assertFalse(invalidMysql.isDatabaseConnected());

        MongoPersistenceConfig mongoConfig = new MongoPersistenceConfig();
        MongoPersistenceConfig.MongoHealthProbe invalidMongo =
                mongoConfig.mongoHealthProbe("", "aetheris", 1000);
        assertFalse(invalidMongo.configValid());
        assertFalse(invalidMongo.isDatabaseConnected());
    }

    @Test
    public void mysqlAdapterCrudAndBenchmarksWhenDatabaseAvailable() {
        String url = System.getenv("AETHERIS_TEST_MYSQL_URL");
        String user = System.getenv("AETHERIS_TEST_MYSQL_USER");
        String pass = System.getenv("AETHERIS_TEST_MYSQL_PASSWORD");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "Skipping live MySQL test: AETHERIS_TEST_MYSQL_URL not set");

        SpringApplication app = new SpringApplication(AetherisApplication.class);
        app.setDefaultProperties(Map.of(
                "server.port", "0",
                "aetheris.persistence.engine", "MYSQL",
                "aetheris.persistence.mysql.url", url,
                "aetheris.persistence.mysql.username", user != null ? user : "aetheris",
                "aetheris.persistence.mysql.password", pass != null ? pass : "aetheris_password"
        ));

        try (ConfigurableApplicationContext ctx = app.run()) {
            MySqlPresetAdapter presetAdapter = ctx.getBean(MySqlPresetAdapter.class);
            MySqlBenchmarkAdapter benchmarkAdapter = ctx.getBean(MySqlBenchmarkAdapter.class);

            assertTrue(presetAdapter.isDatabaseConnected());
            assertTrue(presetAdapter.isAvailable());

            String id = "preset-mysql-test-" + System.currentTimeMillis();
            GridPreset saved = presetAdapter.save(samplePreset(id));
            assertEquals(id, saved.getId());
            assertNotNull(Instant.parse(saved.getCreatedAt()));

            Optional<GridPreset> fetched = presetAdapter.findById(id);
            assertTrue(fetched.isPresent());
            assertEquals("Phase 4 Test Grid", fetched.get().getName());
            assertEquals(4, fetched.get().getGrid().getCells().size());

            saved.setName("Updated MySQL Grid");
            GridPreset updated = presetAdapter.save(saved);
            assertEquals("Updated MySQL Grid", updated.getName());

            String benchId = "bench-mysql-" + System.currentTimeMillis();
            BenchmarkRecord benchSaved = benchmarkAdapter.save(sampleBenchmark(benchId, id));
            assertEquals(benchId, benchSaved.getId());
            assertTrue(benchmarkAdapter.findById(benchId).isPresent());

            assertTrue(presetAdapter.deleteById(id));
            assertFalse(presetAdapter.findById(id).isPresent());
        }
    }

    @Test
    public void mongoAdapterCrudAndCrossDatabasePortabilityWhenDatabasesAvailable() throws Exception {
        String mongoUri = System.getenv("AETHERIS_TEST_MONGODB_URI");
        String mysqlUrl = System.getenv("AETHERIS_TEST_MYSQL_URL");
        Assumptions.assumeTrue(mongoUri != null && !mongoUri.isBlank(), "Skipping live MongoDB test: AETHERIS_TEST_MONGODB_URI not set");

        SpringApplication mongoApp = new SpringApplication(AetherisApplication.class);
        mongoApp.setDefaultProperties(Map.of(
                "server.port", "0",
                "aetheris.persistence.engine", "MONGODB",
                "aetheris.persistence.mongodb.uri", mongoUri,
                "aetheris.persistence.mongodb.database", "aetheris"
        ));

        PresetBundleCodec codec = new PresetBundleCodec(new ObjectMapper());
        String id = "preset-mongo-test-" + System.currentTimeMillis();

        try (ConfigurableApplicationContext mongoCtx = mongoApp.run()) {
            MongoPresetAdapter mongoPresets = mongoCtx.getBean(MongoPresetAdapter.class);
            MongoBenchmarkAdapter mongoBenchmarks = mongoCtx.getBean(MongoBenchmarkAdapter.class);

            assertTrue(mongoPresets.isDatabaseConnected());
            GridPreset saved = mongoPresets.save(samplePreset(id));
            assertEquals(id, saved.getId());
            assertTrue(mongoPresets.findById(id).isPresent());

            String benchId = "bench-mongo-" + System.currentTimeMillis();
            benchmarkRoundtrip(mongoBenchmarks, benchId, id);

            byte[] exportedFromMongo = codec.encodePretty(List.of(saved));
            List<GridPreset> decodedFromMongo = codec.decodeAndValidate(exportedFromMongo);
            assertEquals(1, decodedFromMongo.size());
            assertEquals(id, decodedFromMongo.get(0).getId());

            if (mysqlUrl != null && !mysqlUrl.isBlank()) {
                SpringApplication mysqlApp = new SpringApplication(AetherisApplication.class);
                mysqlApp.setDefaultProperties(Map.of(
                        "server.port", "0",
                        "aetheris.persistence.engine", "MYSQL",
                        "aetheris.persistence.mysql.url", mysqlUrl,
                        "aetheris.persistence.mysql.username", System.getenv().getOrDefault("AETHERIS_TEST_MYSQL_USER", "aetheris"),
                        "aetheris.persistence.mysql.password", System.getenv().getOrDefault("AETHERIS_TEST_MYSQL_PASSWORD", "aetheris_password")
                ));
                try (ConfigurableApplicationContext mysqlCtx = mysqlApp.run()) {
                    MySqlPresetAdapter mysqlPresets = mysqlCtx.getBean(MySqlPresetAdapter.class);
                    GridPreset importedToMysql = mysqlPresets.save(decodedFromMongo.get(0));
                    byte[] exportedFromMysql = codec.encodePretty(List.of(importedToMysql));
                    List<GridPreset> roundtrip = codec.decodeAndValidate(exportedFromMysql);
                    assertEquals(saved.getName(), roundtrip.get(0).getName());
                    assertEquals(saved.getGrid().getRows(), roundtrip.get(0).getGrid().getRows());
                    assertEquals(saved.getGrid().getCells().size(), roundtrip.get(0).getGrid().getCells().size());
                    mysqlPresets.deleteById(id);
                }
            }

            assertTrue(mongoPresets.deleteById(id));
        }
    }

    private static void benchmarkRoundtrip(MongoBenchmarkAdapter adapter, String benchId, String presetId) {
        BenchmarkRecord saved = adapter.save(sampleBenchmark(benchId, presetId));
        assertEquals(benchId, saved.getId());
        assertTrue(adapter.findById(benchId).isPresent());
    }
}
