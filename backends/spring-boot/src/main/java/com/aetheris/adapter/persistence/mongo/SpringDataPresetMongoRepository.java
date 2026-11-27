package com.aetheris.adapter.persistence.mongo;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface SpringDataPresetMongoRepository extends MongoRepository<PresetDocument, String> {
    Optional<PresetDocument> findByDomainId(String domainId);
    boolean existsByDomainId(String domainId);
    long deleteByDomainId(String domainId);
    List<PresetDocument> findAllByOrderByDomainIdAsc();
}
