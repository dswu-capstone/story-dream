package com.storydream.backend.domain.reading.repository;

import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.recommendation.repository.projection.StoryLocalEventCountProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReadingLogRepository extends JpaRepository<ReadingLog, Integer> {
    boolean existsByReadingHistoryIdAndPartType(Integer readingHistoryId, String partType);

    Optional<ReadingLog> findTopByReadingHistoryIdOrderByIdDesc(Integer readingHistoryId);
    Optional<ReadingLog> findTopByReadingHistoryIdAndPartTypeOrderByIdDesc(
            Integer readingHistoryId,
            String partType
    );
    List<ReadingLog> findAllByReadingHistoryIdOrderByCreatedAtAsc(Integer readingHistoryId);

    @Query("""
            SELECT rl.readingHistory.originalStory.id AS originalStoryId,
                   COUNT(DISTINCT rl.readingHistory.id) AS eventCount,
                   MAX(rl.createdAt) AS latestEventAt
              FROM ReadingLog rl
             WHERE rl.readingHistory.child.id = :childId
               AND rl.readingHistory.originalStory.languageCode = :languageCode
               AND rl.partType = :conclusionPartType
             GROUP BY rl.readingHistory.originalStory.id
            """)
    List<StoryLocalEventCountProjection> countBodyCompletionsByStory(
            @Param("childId") Integer childId,
            @Param("languageCode") String languageCode,
            @Param("conclusionPartType") String conclusionPartType
    );
}
