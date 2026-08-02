package com.storydream.backend.domain.reading.repository;

import com.storydream.backend.domain.reading.entity.ReadingLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingLogRepository extends JpaRepository<ReadingLog, Integer> {
}
