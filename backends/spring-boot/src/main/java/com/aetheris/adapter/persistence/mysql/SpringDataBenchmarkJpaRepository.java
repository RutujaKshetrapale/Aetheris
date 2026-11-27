package com.aetheris.adapter.persistence.mysql;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SpringDataBenchmarkJpaRepository extends JpaRepository<BenchmarkEntity, String> {
    List<BenchmarkEntity> findAllByOrderByCreatedAtAsc();
}
