package com.storydream.backend.domain.recommendation.repository;

import com.storydream.backend.domain.recommendation.entity.Recommendation;
import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

public interface RecommendationRepository extends JpaRepository<Recommendation, Long> {

    @Modifying(flushAutomatically = true)
    @Query("""
            UPDATE Recommendation r
               SET r.invalidatedAt = :invalidatedAt,
                   r.invalidationReason = :reason
             WHERE r.child.id = :childId
               AND r.languageCode = :languageCode
               AND r.invalidatedAt IS NULL
            """)
    int invalidateActive(
            @Param("childId") Integer childId,
            @Param("languageCode") String languageCode,
            @Param("invalidatedAt") OffsetDateTime invalidatedAt,
            @Param("reason") RecommendationInvalidationReason reason
    );

    @Modifying(flushAutomatically = true)
    @Query("""
            UPDATE Recommendation r
               SET r.invalidatedAt = :invalidatedAt,
                   r.invalidationReason = :reason
             WHERE r.child.id = :childId
               AND r.invalidatedAt IS NULL
            """)
    int invalidateAllActive(
            @Param("childId") Integer childId,
            @Param("invalidatedAt") OffsetDateTime invalidatedAt,
            @Param("reason") RecommendationInvalidationReason reason
    );
}
