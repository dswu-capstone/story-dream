package com.storydream.backend.domain.reading.repository;

import com.storydream.backend.domain.reading.entity.ReadingHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReadingHistoryRepository extends JpaRepository<ReadingHistory, Integer> {
    Optional<ReadingHistory> findByIdAndChildGuardianId(Integer readingHistoryId, Integer guardianId);
}