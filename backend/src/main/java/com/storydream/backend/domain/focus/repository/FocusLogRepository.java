//package com.storydream.backend.domain.focus.repository;
//
//import com.storydream.backend.domain.focus.entity.FocusLog;
//import com.storydream.backend.domain.report.repository.projection.PartFocusStat;
//import org.springframework.data.domain.Limit;
//import org.springframework.data.jpa.repository.JpaRepository;
//import org.springframework.data.jpa.repository.Query;
//import org.springframework.data.repository.query.Param;
//
//import java.util.List;
//import java.util.Optional;
//
//public interface FocusLogRepository extends JpaRepository<FocusLog, Integer> {
//
//    @Query("""
//        SELECT f.partType AS partType,
//               COUNT(f.id) AS distractionCount,
//               COALESCE(SUM(f.durationSec), 0L) AS distractionSec
//          FROM FocusLog f
//         WHERE f.readingHistory.id = :historyId
//         GROUP BY f.partType
//        """)
//    List<PartFocusStat> findPartStatsByReadingHistoryId(@Param("historyId") Integer historyId);
//
//    Optional<FocusLog> findFirstByReadingHistoryIdAndEndedAtIsNullOrderByStartedAtDesc(
//            Integer readingHistoryId);
//
//    List<FocusLog> findAllByReadingHistoryIdAndEndedAtIsNull(Integer readingHistoryId);
//}



package com.storydream.backend.domain.focus.repository;

import com.storydream.backend.domain.focus.entity.FocusLog;
import com.storydream.backend.domain.report.repository.projection.PartFocusStat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FocusLogRepository extends JpaRepository<FocusLog, Integer> {

    @Query(value = """
        SELECT f.part_type AS partType,
               COUNT(*) AS distractionCount,
               COALESCE(SUM(f.duration_sec), 0) AS distractionSec
          FROM focus_log f
         WHERE f.reading_history_id = :historyId
         GROUP BY f.part_type
        """, nativeQuery = true)
    List<PartFocusStat> findPartStatsByReadingHistoryId(@Param("historyId") Integer historyId);

    Optional<FocusLog> findFirstByReadingHistoryIdAndEndedAtIsNullOrderByStartedAtDesc(
            Integer readingHistoryId);

    List<FocusLog> findAllByReadingHistoryIdAndEndedAtIsNull(Integer readingHistoryId);
}