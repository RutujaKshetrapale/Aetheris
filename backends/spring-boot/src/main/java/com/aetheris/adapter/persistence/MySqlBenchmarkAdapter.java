package com.aetheris.adapter.persistence;

import com.aetheris.adapter.persistence.mysql.*;
import com.aetheris.domain.exception.PersistenceUnavailableException;
import com.aetheris.domain.model.AlgorithmType;
import com.aetheris.domain.model.BenchmarkRecord;
import com.aetheris.domain.model.HeuristicType;
import com.aetheris.port.BenchmarkRepositoryPort;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA / Hibernate benchmark persistence adapter for MySQL 9.7.
 */
public class MySqlBenchmarkAdapter implements BenchmarkRepositoryPort {

    private final SpringDataBenchmarkJpaRepository repository;
    private final MySqlPersistenceConfig.MySqlHealthProbe healthProbe;

    public MySqlBenchmarkAdapter(
            SpringDataBenchmarkJpaRepository repository,
            MySqlPersistenceConfig.MySqlHealthProbe healthProbe) {
        this.repository = repository;
        this.healthProbe = healthProbe;
    }

    @Override
    @Transactional(transactionManager = "mysqlTransactionManager")
    public BenchmarkRecord save(BenchmarkRecord record) {
        ensureConfigured();
        try {
            if (record.getId() == null || record.getId().isBlank()) {
                record.setId("bench-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            }
            Instant createdAt = parseInstantOrNow(record.getCreatedAt(), Instant.now());
            record.setCreatedAt(createdAt.toString());

            BenchmarkEntity entity = new BenchmarkEntity();
            entity.setId(record.getId());
            entity.setName(record.getName());
            entity.setPresetId(record.getPresetId());
            entity.setAlgorithm(record.getAlgorithm().name());
            entity.setHeuristic(record.getHeuristic().name());
            entity.setGridRows(record.getGridRows());
            entity.setGridCols(record.getGridCols());
            entity.setStartNode(record.getStartNode());
            entity.setTargetNode(record.getTargetNode());
            entity.setPathFound(record.isPathFound());
            entity.setPathNodeCount(record.getPathNodeCount());
            entity.setPathEdgeCount(record.getPathEdgeCount());
            entity.setAlgorithmPathCost(record.getAlgorithmPathCost());
            entity.setTerrainPathCost(record.getTerrainPathCost());
            entity.setNodesVisited(record.getNodesVisited());
            entity.setMaxFrontierSize(record.getMaxFrontierSize());
            entity.setTotalSteps(record.getTotalSteps());
            entity.setExecutionTimeMs(record.getExecutionTimeMs());
            entity.setCreatedAt(createdAt);

            BenchmarkEntity saved = repository.saveAndFlush(entity);
            return toDomain(saved);
        } catch (RuntimeException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    @Transactional(transactionManager = "mysqlTransactionManager", readOnly = true)
    public Optional<BenchmarkRecord> findById(String id) {
        ensureConfigured();
        try {
            return repository.findById(id).map(MySqlBenchmarkAdapter::toDomain);
        } catch (RuntimeException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    @Transactional(transactionManager = "mysqlTransactionManager", readOnly = true)
    public List<BenchmarkRecord> findAll() {
        ensureConfigured();
        try {
            return repository.findAllByOrderByCreatedAtAsc().stream()
                    .map(MySqlBenchmarkAdapter::toDomain)
                    .toList();
        } catch (RuntimeException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    public String getAdapterType() {
        return "MYSQL";
    }

    @Override
    public boolean isAvailable() {
        return healthProbe.isDatabaseConnected();
    }

    @Override
    public boolean isDatabaseConnected() {
        return healthProbe.isDatabaseConnected();
    }

    private void ensureConfigured() {
        if (!healthProbe.configValid()) {
            throw new PersistenceUnavailableException("MYSQL", healthProbe.configError());
        }
    }

    private PersistenceUnavailableException unavailable(RuntimeException ex) {
        if (ex instanceof PersistenceUnavailableException pue) {
            return pue;
        }
        return new PersistenceUnavailableException("MYSQL", "MySQL persistence is currently unavailable.");
    }

    private static Instant parseInstantOrNow(String value, Instant fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Instant.parse(value);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static BenchmarkRecord toDomain(BenchmarkEntity entity) {
        return new BenchmarkRecord(
                entity.getId(),
                entity.getName(),
                entity.getPresetId(),
                AlgorithmType.valueOf(entity.getAlgorithm()),
                HeuristicType.valueOf(entity.getHeuristic()),
                entity.getGridRows(),
                entity.getGridCols(),
                entity.getStartNode(),
                entity.getTargetNode(),
                entity.isPathFound(),
                entity.getPathNodeCount(),
                entity.getPathEdgeCount(),
                entity.getAlgorithmPathCost(),
                entity.getTerrainPathCost(),
                entity.getNodesVisited(),
                entity.getMaxFrontierSize(),
                entity.getTotalSteps(),
                entity.getExecutionTimeMs(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : Instant.now().toString()
        );
    }
}
