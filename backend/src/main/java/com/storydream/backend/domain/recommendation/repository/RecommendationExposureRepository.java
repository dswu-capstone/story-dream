package com.storydream.backend.domain.recommendation.repository;

import com.storydream.backend.domain.recommendation.entity.RecommendationExposure;
import com.storydream.backend.domain.recommendation.repository.projection.StoryEventCountProjection;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RecommendationExposureRepository
        extends JpaRepository<RecommendationExposure, Long> {

    Optional<RecommendationExposure> findByRecommendationItemIdAndViewSessionId(
            Long recommendationItemId,
            String viewSessionId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT re
            FROM RecommendationExposure re
            JOIN FETCH re.recommendationItem ri
            JOIN FETCH ri.originalStory os
            JOIN FETCH ri.recommendation r
            JOIN FETCH r.child c
            WHERE re.id = :exposureId
              AND c.guardian.id = :guardianId
            """)
    Optional<RecommendationExposure> findOwnedExposureForUpdate(
            @Param("exposureId") Long exposureId,
            @Param("guardianId") Integer guardianId
    );

    @Query("""
            SELECT ri.originalStory.id AS originalStoryId,
                   COUNT(re.id) AS eventCount
              FROM RecommendationExposure re
              JOIN re.recommendationItem ri
              JOIN ri.recommendation r
             WHERE r.child.id = :childId
               AND r.languageCode = :languageCode
             GROUP BY ri.originalStory.id
            """)
    List<StoryEventCountProjection> countExposuresByStory(
            @Param("childId") Integer childId,
            @Param("languageCode") String languageCode
    );
}
