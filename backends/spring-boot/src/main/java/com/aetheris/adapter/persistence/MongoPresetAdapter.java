package com.aetheris.adapter.persistence;

import com.aetheris.adapter.persistence.mongo.MongoPersistenceConfig;
import com.aetheris.adapter.persistence.mongo.PresetDocument;
import com.aetheris.adapter.persistence.mongo.SpringDataPresetMongoRepository;
import com.aetheris.domain.exception.PersistenceUnavailableException;
import com.aetheris.domain.model.GridPreset;
import com.aetheris.port.PresetRepositoryPort;
import com.mongodb.MongoException;
import org.springframework.dao.DataAccessException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data MongoDB persistence adapter for MongoDB 9.0.
 */
public class MongoPresetAdapter implements PresetRepositoryPort {

    private final SpringDataPresetMongoRepository repository;
    private final MongoPersistenceConfig.MongoHealthProbe healthProbe;

    public MongoPresetAdapter(
            SpringDataPresetMongoRepository repository,
            MongoPersistenceConfig.MongoHealthProbe healthProbe) {
        this.repository = repository;
        this.healthProbe = healthProbe;
    }

    @Override
    public List<GridPreset> findAll() {
        ensureConfigured();
        try {
            return repository.findAllByOrderByDomainIdAsc().stream()
                    .map(MongoPresetAdapter::toDomain)
                    .toList();
        } catch (DataAccessException | MongoException ex) {
            throw unavailable();
        }
    }

    @Override
    public Optional<GridPreset> findById(String id) {
        ensureConfigured();
        try {
            return repository.findByDomainId(id).map(MongoPresetAdapter::toDomain);
        } catch (DataAccessException | MongoException ex) {
            throw unavailable();
        }
    }

    @Override
    public boolean existsById(String id) {
        ensureConfigured();
        if (id == null || id.isBlank()) {
            return false;
        }
        try {
            return repository.existsByDomainId(id);
        } catch (DataAccessException | MongoException ex) {
            throw unavailable();
        }
    }

    @Override
    public GridPreset save(GridPreset preset) {
        ensureConfigured();
        try {
            if (preset.getId() == null || preset.getId().isBlank()) {
                preset.setId("preset-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            }
            Instant now = Instant.now();
            String createdAt = normalizeUtc(preset.getCreatedAt(), now);
            preset.setCreatedAt(createdAt);

            PresetDocument doc = repository.findByDomainId(preset.getId()).orElseGet(PresetDocument::new);
            doc.setDomainId(preset.getId());
            doc.setName(preset.getName());
            doc.setDescription(preset.getDescription());
            doc.setGrid(preset.getGrid());
            doc.setCreatedAt(doc.getCreatedAt() != null ? doc.getCreatedAt() : createdAt);
            doc.setUpdatedAt(now.toString());

            PresetDocument saved = repository.save(doc);
            return toDomain(saved);
        } catch (DataAccessException | MongoException ex) {
            throw unavailable();
        }
    }

    @Override
    public boolean deleteById(String id) {
        ensureConfigured();
        if (id == null || id.isBlank()) {
            return false;
        }
        try {
            return repository.deleteByDomainId(id) > 0;
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

    private static GridPreset toDomain(PresetDocument doc) {
        return new GridPreset(
                doc.getDomainId(),
                doc.getName(),
                doc.getDescription(),
                doc.getGrid(),
                doc.getCreatedAt() != null ? doc.getCreatedAt() : Instant.now().toString()
        );
    }
}
