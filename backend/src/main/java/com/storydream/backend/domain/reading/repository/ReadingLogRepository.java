package com.storydream.backend.domain.reading.repository;

import com.storydream.backend.domain.reading.entity.ReadingLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReadingLogRepository extends JpaRepository<ReadingLog, Integer> {
    Optional<ReadingLog> findTopByReadingHistoryIdOrderByIdDesc(Integer readingHistoryId);
    Optional<ReadingLog> findTopByReadingHistoryIdAndPartTypeOrderByIdDesc(
            Integer readingHistoryId,
            String partType
    );
    List<ReadingLog> findAllByReadingHistoryIdOrderByCreatedAtAsc(Integer readingHistoryId);
}
