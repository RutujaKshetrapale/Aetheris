package com.aetheris.config;

import com.aetheris.adapter.persistence.*;
import com.aetheris.adapter.persistence.mongo.MongoPersistenceConfig;
import com.aetheris.adapter.persistence.mongo.SpringDataBenchmarkMongoRepository;
import com.aetheris.adapter.persistence.mongo.SpringDataPresetMongoRepository;
import com.aetheris.adapter.persistence.mysql.MySqlPersistenceConfig;
import com.aetheris.adapter.persistence.mysql.SpringDataBenchmarkJpaRepository;
import com.aetheris.adapter.persistence.mysql.SpringDataPresetJpaRepository;
import com.aetheris.port.BenchmarkRepositoryPort;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.Set;

@Configuration
public class PersistenceConfig {

    private static final Set<String> SUPPORTED_ENGINES = Set.of("IN_MEMORY", "MYSQL", "MONGODB");

    private static String normalizeAndValidateEngine(String engine) {
        String normalized = engine == null ? "IN_MEMORY" : engine.trim().toUpperCase();
        if (!SUPPORTED_ENGINES.contains(normalized)) {
            throw new IllegalStateException(
                    "Unsupported AETHERIS_PERSISTENCE_ENGINE '" + engine + "'. Expected one of: IN_MEMORY, MYSQL, MONGODB.");
        }
        return normalized;
    }

    @Bean
    @Primary
    public PresetRepositoryPort presetRepositoryPort(
            @Value("${aetheris.persistence.engine:IN_MEMORY}") String engine,
            ObjectProvider<SpringDataPresetJpaRepository> mysqlPresetRepo,
            ObjectProvider<MySqlPersistenceConfig.MySqlHealthProbe> mysqlProbe,
            ObjectProvider<SpringDataPresetMongoRepository> mongoPresetRepo,
            ObjectProvider<MongoPersistenceConfig.MongoHealthProbe> mongoProbe) {
        String normalized = normalizeAndValidateEngine(engine);
        return switch (normalized) {
            case "MYSQL" -> new MySqlPresetAdapter(
                    mysqlPresetRepo.getObject(),
                    mysqlProbe.getObject());
            case "MONGODB" -> new MongoPresetAdapter(
                    mongoPresetRepo.getObject(),
                    mongoProbe.getObject());
            default -> new InMemoryPresetAdapter();
        };
    }

    @Bean
    @Primary
    public BenchmarkRepositoryPort benchmarkRepositoryPort(
            @Value("${aetheris.persistence.engine:IN_MEMORY}") String engine,
            ObjectProvider<SpringDataBenchmarkJpaRepository> mysqlBenchmarkRepo,
            ObjectProvider<MySqlPersistenceConfig.MySqlHealthProbe> mysqlProbe,
            ObjectProvider<SpringDataBenchmarkMongoRepository> mongoBenchmarkRepo,
            ObjectProvider<MongoPersistenceConfig.MongoHealthProbe> mongoProbe) {
        String normalized = normalizeAndValidateEngine(engine);
        return switch (normalized) {
            case "MYSQL" -> new MySqlBenchmarkAdapter(
                    mysqlBenchmarkRepo.getObject(),
                    mysqlProbe.getObject());
            case "MONGODB" -> new MongoBenchmarkAdapter(
                    mongoBenchmarkRepo.getObject(),
                    mongoProbe.getObject());
            default -> new InMemoryBenchmarkAdapter();
        };
    }
}
