package com.aetheris.adapter.persistence;

import com.aetheris.adapter.persistence.mysql.*;
import com.aetheris.domain.exception.PersistenceUnavailableException;
import com.aetheris.domain.model.*;
import com.aetheris.port.PresetRepositoryPort;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Spring Data JPA / Hibernate persistence adapter for MySQL 9.7.
 */
public class MySqlPresetAdapter implements PresetRepositoryPort {

    private final SpringDataPresetJpaRepository repository;
    private final MySqlPersistenceConfig.MySqlHealthProbe healthProbe;

    public MySqlPresetAdapter(
            SpringDataPresetJpaRepository repository,
            MySqlPersistenceConfig.MySqlHealthProbe healthProbe) {
        this.repository = repository;
        this.healthProbe = healthProbe;
    }

    @Override
    @Transactional(transactionManager = "mysqlTransactionManager", readOnly = true)
    public List<GridPreset> findAll() {
        ensureConfigured();
        try {
            return repository.findAllByOrderByIdAsc().stream()
                    .map(MySqlPresetAdapter::toDomain)
                    .toList();
        } catch (DataAccessException | RuntimeException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    @Transactional(transactionManager = "mysqlTransactionManager", readOnly = true)
    public Optional<GridPreset> findById(String id) {
        ensureConfigured();
        try {
            return repository.findById(id).map(MySqlPresetAdapter::toDomain);
        } catch (DataAccessException | RuntimeException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    @Transactional(transactionManager = "mysqlTransactionManager", readOnly = true)
    public boolean existsById(String id) {
        ensureConfigured();
        if (id == null || id.isBlank()) {
            return false;
        }
        try {
            return repository.existsById(id);
        } catch (DataAccessException | RuntimeException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    @Transactional(transactionManager = "mysqlTransactionManager")
    public GridPreset save(GridPreset preset) {
        ensureConfigured();
        try {
            if (preset.getId() == null || preset.getId().isBlank()) {
                preset.setId("preset-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            }
            Instant now = Instant.now();
            Instant createdAt = parseInstantOrNow(preset.getCreatedAt(), now);
            preset.setCreatedAt(createdAt.toString());

            PresetEntity entity = repository.findById(preset.getId()).orElseGet(PresetEntity::new);
            entity.setId(preset.getId());
            entity.setName(preset.getName());
            entity.setDescription(preset.getDescription());
            entity.setGridRows(preset.getGrid().getRows());
            entity.setGridCols(preset.getGrid().getCols());
            entity.setStartNode(preset.getGrid().getStartNode());
            entity.setTargetNode(preset.getGrid().getTargetNode());
            entity.setCreatedAt(entity.getCreatedAt() != null ? entity.getCreatedAt() : createdAt);
            entity.setUpdatedAt(now);

            entity.getCells().clear();
            if (preset.getGrid().getCells() != null) {
                for (CellDefinition cell : preset.getGrid().getCells()) {
                    PresetCellEntity cellEntity = new PresetCellEntity();
                    cellEntity.setId(new PresetCellId(preset.getId(), cell.getId()));
                    cellEntity.setPreset(entity);
                    cellEntity.setCellRow(cell.getRow());
                    cellEntity.setCellCol(cell.getCol());
                    cellEntity.setCellType(cell.getCellType().name());
                    cellEntity.setWeight(cell.getWeight());
                    entity.getCells().add(cellEntity);
                }
            }

            PresetEntity saved = repository.saveAndFlush(entity);
            return toDomain(saved);
        } catch (DataAccessException | RuntimeException ex) {
            throw unavailable(ex);
        }
    }

    @Override
    @Transactional(transactionManager = "mysqlTransactionManager")
    public boolean deleteById(String id) {
        ensureConfigured();
        if (id == null || id.isBlank()) {
            return false;
        }
        try {
            if (!repository.existsById(id)) {
                return false;
            }
            repository.deleteById(id);
            repository.flush();
            return true;
        } catch (DataAccessException | RuntimeException ex) {
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

    private static GridPreset toDomain(PresetEntity entity) {
        List<CellDefinition> cells = new ArrayList<>();
        if (entity.getCells() != null) {
            for (PresetCellEntity c : entity.getCells()) {
                cells.add(new CellDefinition(
                        c.getId().getCellId(),
                        c.getCellRow(),
                        c.getCellCol(),
                        CellType.valueOf(c.getCellType()),
                        c.getWeight()
                ));
            }
        }
        GridModel grid = new GridModel(
                entity.getGridRows(),
                entity.getGridCols(),
                entity.getStartNode(),
                entity.getTargetNode(),
                cells
        );
        return new GridPreset(
                entity.getId(),
                entity.getName(),
                entity.getDescription(),
                grid,
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : Instant.now().toString()
        );
    }
}
