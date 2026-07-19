package com.storydream.backend.domain.report.repository;

import com.storydream.backend.domain.reading.entity.ReadingStatus;
import com.storydream.backend.domain.report.entity.AiReadingReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AiReadingReportRepository extends JpaRepository<AiReadingReport, Integer> {

    boolean existsByReadingHistoryId(Integer readingHistoryId);

    @Query("""
            select distinct r
            from AiReadingReport r
            left join fetch r.parts
            join fetch r.readingHistory rh
            join fetch rh.originalStory
            join fetch rh.child c
            join fetch c.guardian
            where rh.id = :readingHistoryId
            """)
    Optional<AiReadingReport> findDetailByReadingHistoryId(
            @Param("readingHistoryId") Integer readingHistoryId
    );

    @Query("""
            select r
            from AiReadingReport r
            join fetch r.readingHistory rh
            join fetch rh.originalStory
            where rh.child.id = :childId
              and rh.status = :status
              and rh.endedAt >= :startAt
              and rh.endedAt < :endAt
            order by rh.endedAt asc
            """)
    List<AiReadingReport> findAllInPeriod(
            @Param("childId") Integer childId,
            @Param("status") ReadingStatus status,
            @Param("startAt") LocalDateTime startAt,
            @Param("endAt") LocalDateTime endAt
    );
}