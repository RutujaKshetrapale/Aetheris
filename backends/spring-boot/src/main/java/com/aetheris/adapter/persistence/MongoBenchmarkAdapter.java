package com.aetheris.adapter.persistence;

import com.aetheris.adapter.persistence.mongo.BenchmarkDocument;
import com.aetheris.adapter.persistence.mongo.MongoPersistenceConfig;
import com.aetheris.adapter.persistence.mongo.SpringDataBenchmarkMongoRepository;
import com.aetheris.domain.exception.PersistenceUnavailableException;
import com.aetheris.domain.model.AlgorithmType;
import com.aetheris.domain.model.BenchmarkRecord;
import com.aetheris.domain.model.HeuristicType;
import com.aetheris.port.BenchmarkRepositoryPort;
import com.mongodb.MongoException;
import org.springframework.dao.DataAccessException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data MongoDB benchmark persistence adapter for MongoDB 9.0.
 */
public class MongoBenchmarkAdapter implements BenchmarkRepositoryPort {

    private final SpringDataBenchmarkMongoRepository repository;
    private final MongoPersistenceConfig.MongoHealthProbe healthProbe;

    public MongoBenchmarkAdapter(
            SpringDataBenchmarkMongoRepository repository,
            MongoPersistenceConfig.MongoHealthProbe healthProbe) {
        this.repository = repository;
        this.healthProbe = healthProbe;
    }

    @Override
    public BenchmarkRecord save(BenchmarkRecord record) {
        ensureConfigured();
        try {
            if (record.getId() == null || record.getId().isBlank()) {
                record.setId("bench-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            }
            String createdAt = normalizeUtc(record.getCreatedAt(), Instant.now());
            record.setCreatedAt(createdAt);

            BenchmarkDocument doc = new BenchmarkDocument();
            doc.setDomainId(record.getId());
            doc.setName(record.getName());
            doc.setPresetId(record.getPresetId());
            doc.setAlgorithm(record.getAlgorithm().name());
            doc.setHeuristic(record.getHeuristic().name());
            doc.setGridRows(record.getGridRows());
            doc.setGridCols(record.getGridCols());
            doc.setStartNode(record.getStartNode());
            doc.setTargetNode(record.getTargetNode());
            doc.setPathFound(record.isPathFound());
            doc.setPathNodeCount(record.getPathNodeCount());
            doc.setPathEdgeCount(record.getPathEdgeCount());
            doc.setAlgorithmPathCost(record.getAlgorithmPathCost());
            doc.setTerrainPathCost(record.getTerrainPathCost());
            doc.setNodesVisited(record.getNodesVisited());
            doc.setMaxFrontierSize(record.getMaxFrontierSize());
            doc.setTotalSteps(record.getTotalSteps());
            doc.setExecutionTimeMs(record.getExecutionTimeMs());
            doc.setCreatedAt(createdAt);

            BenchmarkDocument saved = repository.save(doc);
            return toDomain(saved);
        } catch (DataAccessException | MongoException ex) {
            throw unavailable();
        }
    }

    @Override
    public Optional<BenchmarkRecord> findById(String id) {
        ensureConfigured();
        try {
            return repository.findByDomainId(id).map(MongoBenchmarkAdapter::toDomain);
        } catch (DataAccessException | MongoException ex) {
            throw unavailable();
        }
    }

    @Override
    public List<BenchmarkRecord> findAll() {
        ensureConfigured();
        try {
            return repository.findAllByOrderByCreatedAtAsc().stream()
                    .map(MongoBenchmarkAdapter::toDomain)
                    .toList();
        } catch (DataAccessException | MongoException ex) {
            throw unavailable();
        }
    }

    @Override
    public String getAdapterType() {
        return "MONGODB";
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
            throw new PersistenceUnavailableException("MONGODB", healthProbe.configError());
        }
    }

    private PersistenceUnavailableException unavailable() {
        return new PersistenceUnavailableException("MONGODB", "MongoDB persistence is currently unavailable.");
    }

    private static String normalizeUtc(String value, Instant fallback) {
        if (value == null || value.isBlank()) {
            return fallback.toString();
        }
        try {
            return Instant.parse(value).toString();
        } catch (Exception ignored) {
            return fallback.toString();
        }
    }

    private static BenchmarkRecord toDomain(BenchmarkDocument doc) {
        return new BenchmarkRecord(
                doc.getDomainId(),
                doc.getName(),
                doc.getPresetId(),
                AlgorithmType.valueOf(doc.getAlgorithm()),
                HeuristicType.valueOf(doc.getHeuristic()),
                doc.getGridRows(),
                doc.getGridCols(),
                doc.getStartNode(),
                doc.getTargetNode(),
                doc.isPathFound(),
                doc.getPathNodeCount(),
                doc.getPathEdgeCount(),
                doc.getAlgorithmPathCost(),
                doc.getTerrainPathCost(),
                doc.getNodesVisited(),
                doc.getMaxFrontierSize(),
                doc.getTotalSteps(),
                doc.getExecutionTimeMs(),
                doc.getCreatedAt() != null ? doc.getCreatedAt() : Instant.now().toString()
        );
    }
}
