package com.aetheris.config;

import com.aetheris.adapter.persistence.*;
import com.aetheris.port.BenchmarkRepositoryPort;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class PersistenceConfig {

    @Bean
    @Primary
    public PresetRepositoryPort presetRepositoryPort(
            @Value("${aetheris.persistence.engine:IN_MEMORY}") String engine) {
        if ("MYSQL".equalsIgnoreCase(engine)) {
            return new MySqlPresetAdapter(engine);
        } else if ("MONGODB".equalsIgnoreCase(engine)) {
            return new MongoPresetAdapter(engine);
        } else {
            return new InMemoryPresetAdapter();
        }
    }

    @Bean
    @Primary
    public BenchmarkRepositoryPort benchmarkRepositoryPort(
            @Value("${aetheris.persistence.engine:IN_MEMORY}") String engine) {
        if ("MYSQL".equalsIgnoreCase(engine)) {
            return new MySqlBenchmarkAdapter();
        } else if ("MONGODB".equalsIgnoreCase(engine)) {
            return new MongoBenchmarkAdapter();
        } else {
            return new InMemoryBenchmarkAdapter();
        }
    }
}
