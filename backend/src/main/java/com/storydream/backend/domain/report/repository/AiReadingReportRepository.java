package com.storydream.backend.domain.report.repository;

import com.storydream.backend.domain.report.entity.AiReadingReport;
import com.storydream.backend.domain.report.repository.projection.PeriodAggregate;
import com.storydream.backend.domain.report.repository.projection.WeeklyScoreStat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AiReadingReportRepository extends JpaRepository<AiReadingReport, Integer> {

    Optional<AiReadingReport> findByReadingHistoryId(Integer readingHistoryId);

    @Query("""
        SELECT r FROM AiReadingReport r
          JOIN FETCH r.readingHistory rh
          JOIN FETCH rh.originalStory s
         WHERE r.child.id = :childId
           AND r.status = com.storydream.backend.domain.report.entity.ReportStatus.COMPLETED
           AND rh.endedAt >= :fromTs
           AND rh.endedAt <  :toTs
         ORDER BY rh.endedAt DESC
        """)
    Page<AiReadingReport> findCompletedByChildIdAndPeriod(@Param("childId") Integer childId,
                                                          @Param("fromTs") LocalDateTime fromTs,
                                                          @Param("toTs") LocalDateTime toTs,
                                                          Pageable pageable);

    @EntityGraph(attributePaths = {
            "readingHistory",
            "readingHistory.originalStory",
            "child",
            "child.guardian",
            "parts"})
    Optional<AiReadingReport> findWithDetailById(Integer id);

    @Query(value = """
        SELECT CAST(((rh.ended_at::date - CAST(:fromDate AS date)) / 7) AS INTEGER) AS bucketIndex,
               COUNT(r.id) AS readingCount,
               ROUND(AVG(r.average_quiz_score), 1) AS avgScore
          FROM ai_reading_report r
          JOIN reading_history rh ON rh.id = r.reading_history_id
         WHERE r.child_id = :childId
           AND r.status = 'COMPLETED'
           AND rh.ended_at >= CAST(:fromDate AS date)
           AND rh.ended_at <  CAST(:toDate AS date) + 1
         GROUP BY 1
         ORDER BY 1
        """, nativeQuery = true)
    List<WeeklyScoreStat> findWeeklyScores(@Param("childId") Integer childId,
                                           @Param("fromDate") LocalDate fromDate,
                                           @Param("toDate") LocalDate toDate);

    @Query("""
        SELECT COUNT(r.id) AS reportCount,
               AVG(r.averageQuizScore) AS avgScore,
               AVG(r.focusRate) AS avgFocusRate
          FROM AiReadingReport r
         WHERE r.child.id = :childId
           AND r.status = com.storydream.backend.domain.report.entity.ReportStatus.COMPLETED
           AND r.readingHistory.endedAt >= :fromTs
           AND r.readingHistory.endedAt <  :toTs
        """)
    PeriodAggregate findPeriodAggregate(@Param("childId") Integer childId,
                                        @Param("fromTs") LocalDateTime fromTs,
                                        @Param("toTs") LocalDateTime toTs);
}
