package com.aetheris.adapter.persistence;

import com.aetheris.domain.model.BenchmarkRecord;
import com.aetheris.port.BenchmarkRepositoryPort;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryBenchmarkAdapter implements BenchmarkRepositoryPort {

    private final Map<String, BenchmarkRecord> storage = new ConcurrentHashMap<>();

    @Override
    public BenchmarkRecord save(BenchmarkRecord record) {
        if (record.getId() == null || record.getId().isBlank()) {
            record.setId("bench-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        }
        storage.put(record.getId(), record);
        return record;
    }

    @Override
    public Optional<BenchmarkRecord> findById(String id) {
        return Optional.ofNullable(storage.get(id));
    }

    @Override
    public List<BenchmarkRecord> findAll() {
        List<BenchmarkRecord> list = new ArrayList<>(storage.values());
        list.sort(Comparator.comparing(BenchmarkRecord::getCreatedAt, Comparator.nullsLast(String::compareTo)));
        return list;
    }

    @Override
    public String getAdapterType() {
        return "IN_MEMORY";
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public boolean isDatabaseConnected() {
        return false;
    }
}
