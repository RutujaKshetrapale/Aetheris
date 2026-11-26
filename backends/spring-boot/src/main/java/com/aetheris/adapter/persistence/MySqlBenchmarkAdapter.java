package com.aetheris.adapter.persistence;

import com.aetheris.domain.model.BenchmarkRecord;
import com.aetheris.port.BenchmarkRepositoryPort;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

public class MySqlBenchmarkAdapter implements BenchmarkRepositoryPort {

    @Override
    public BenchmarkRecord save(BenchmarkRecord record) {
        throw new UnsupportedOperationException("MySQL benchmark persistence adapter pending Phase 4 implementation.");
    }

    @Override
    public Optional<BenchmarkRecord> findById(String id) {
        return Optional.empty();
    }

    @Override
    public List<BenchmarkRecord> findAll() {
        return Collections.emptyList();
    }

    @Override
    public String getAdapterType() {
        return "MYSQL";
    }

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public boolean isDatabaseConnected() {
        return false;
    }
}
