package com.storydream.backend.domain.recommendation.repository;

import com.storydream.backend.domain.recommendation.entity.StoryClick;
import com.storydream.backend.domain.recommendation.repository.projection.StoryOffsetEventCountProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StoryClickRepository extends JpaRepository<StoryClick, Long> {
    Optional<StoryClick> findByRecommendationExposureId(Long recommendationExposureId);

    @Query("""
            SELECT COUNT(DISTINCT ri.originalStory.id)
              FROM StoryClick sc
              JOIN sc.recommendationExposure re
              JOIN re.recommendationItem ri
              JOIN ri.recommendation r
             WHERE r.child.id = :childId
               AND r.languageCode = :languageCode
               AND r.invalidatedAt IS NULL
            """)
    long countDistinctClickedStoriesInActiveCycle(
            @Param("childId") Integer childId,
            @Param("languageCode") String languageCode
    );

    @Query("""
            SELECT ri.originalStory.id AS originalStoryId,
                   COUNT(sc.id) AS eventCount,
                   MAX(sc.clickedAt) AS latestEventAt
              FROM StoryClick sc
              JOIN sc.recommendationExposure re
              JOIN re.recommendationItem ri
              JOIN ri.recommendation r
             WHERE r.child.id = :childId
               AND r.languageCode = :languageCode
             GROUP BY ri.originalStory.id
            """)
    List<StoryOffsetEventCountProjection> countClicksByStory(
            @Param("childId") Integer childId,
            @Param("languageCode") String languageCode
    );
}
