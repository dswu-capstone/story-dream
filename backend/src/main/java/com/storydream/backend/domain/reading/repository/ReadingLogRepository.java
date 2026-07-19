package com.storydream.backend.domain.reading.repository;

import com.storydream.backend.domain.reading.entity.ReadingLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReadingLogRepository extends JpaRepository<ReadingLog, Integer> {

    /** 같은 문단이 여러 번 기록될 수 있으므로 id 오름차순으로 전부 가져와 마지막 값을 쓴다. */
    List<ReadingLog> findByReadingHistoryIdOrderByIdAsc(Integer readingHistoryId);
}