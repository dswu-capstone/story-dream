package com.storydream.backend.domain.recommendation.repository;

import com.storydream.backend.domain.recommendation.entity.RecommendationItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RecommendationItemRepository extends JpaRepository<RecommendationItem, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT ri
            FROM RecommendationItem ri
            JOIN FETCH ri.recommendation r
            JOIN FETCH r.child c
            WHERE r.id = :recommendationId
              AND ri.originalStory.id = :originalStoryId
              AND c.guardian.id = :guardianId
            """)
    Optional<RecommendationItem> findOwnedItemForUpdate(
            @Param("recommendationId") Long recommendationId,
            @Param("originalStoryId") Integer originalStoryId,
            @Param("guardianId") Integer guardianId
    );
}
