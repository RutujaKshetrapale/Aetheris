package com.aetheris.adapter.persistence.mysql;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SpringDataPresetJpaRepository extends JpaRepository<PresetEntity, String> {
    List<PresetEntity> findAllByOrderByIdAsc();
}
