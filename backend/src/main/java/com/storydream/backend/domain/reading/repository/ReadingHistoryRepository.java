package com.storydream.backend.domain.reading.repository;

import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingStatus;
import com.storydream.backend.domain.recommendation.repository.projection.StoryReadingCountProjection;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReadingHistoryRepository extends JpaRepository<ReadingHistory, Integer> {
    Optional<ReadingHistory> findByIdAndChildGuardianId(Integer readingHistoryId, Integer guardianId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rh FROM ReadingHistory rh WHERE rh.id = :historyId AND rh.child.guardian.id = :guardianId")
    Optional<ReadingHistory> findOwnedByIdForUpdate(
            @Param("historyId") Integer historyId,
            @Param("guardianId") Integer guardianId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rh FROM ReadingHistory rh WHERE rh.id = :readingHistoryId")
    Optional<ReadingHistory> findByIdForUpdate(
            @Param("readingHistoryId") Integer readingHistoryId
    );

    @Query("""
            SELECT rh.originalStory.id AS originalStoryId,
                   COUNT(rh.id) AS readingStartCount,
                   SUM(CASE WHEN rh.status = :completedStatus THEN 1 ELSE 0 END)
                       AS readingCompletionCount,
                   MAX(rh.startedAt) AS latestReadingStartedAt,
                   MAX(CASE WHEN rh.status = :completedStatus THEN rh.endedAt ELSE NULL END)
                       AS latestReadingCompletedAt
              FROM ReadingHistory rh
             WHERE rh.child.id = :childId
               AND rh.originalStory.languageCode = :languageCode
             GROUP BY rh.originalStory.id
            """)
    List<StoryReadingCountProjection> countReadingBehaviorByStory(
            @Param("childId") Integer childId,
            @Param("languageCode") String languageCode,
            @Param("completedStatus") ReadingStatus completedStatus
    );
}
