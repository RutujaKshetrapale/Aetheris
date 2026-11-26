package com.aetheris.port;

import com.aetheris.domain.model.BenchmarkRecord;

import java.util.List;
import java.util.Optional;

public interface BenchmarkRepositoryPort {
    BenchmarkRecord save(BenchmarkRecord record);
    Optional<BenchmarkRecord> findById(String id);
    List<BenchmarkRecord> findAll();
    String getAdapterType();
    boolean isAvailable();
    boolean isDatabaseConnected();
}
