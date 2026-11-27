package com.aetheris.adapter.persistence.mongo;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface SpringDataBenchmarkMongoRepository extends MongoRepository<BenchmarkDocument, String> {
    Optional<BenchmarkDocument> findByDomainId(String domainId);
    List<BenchmarkDocument> findAllByOrderByCreatedAtAsc();
}
