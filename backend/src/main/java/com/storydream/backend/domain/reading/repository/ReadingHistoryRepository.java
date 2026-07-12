package com.storydream.backend.domain.reading.repository;

import com.storydream.backend.domain.reading.entity.ReadingHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingHistoryRepository extends JpaRepository<ReadingHistory, Integer> {
}