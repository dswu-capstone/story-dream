package com.storydream.backend.domain.recommendation.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Entity
@Getter
@Table(name = "recommendation_performance_log")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecommendationPerformanceLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_id", nullable = false, unique = true)
    private Recommendation recommendation;

    @Column(name = "cache_hit", nullable = false)
    private Boolean cacheHit;

    @Column(name = "behavior_aggregation_ms", nullable = false)
    private Long behaviorAggregationMs;

    @Column(name = "ai_or_cache_ms", nullable = false)
    private Long aiOrCacheMs;

    @Column(name = "persistence_ms", nullable = false)
    private Long persistenceMs;

    @Column(name = "total_ms", nullable = false)
    private Long totalMs;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public RecommendationPerformanceLog(
            Recommendation recommendation,
            Boolean cacheHit,
            Long behaviorAggregationMs,
            Long aiOrCacheMs,
            Long persistenceMs,
            Long totalMs
    ) {
        this.recommendation = recommendation;
        this.cacheHit = cacheHit;
        this.behaviorAggregationMs = behaviorAggregationMs;
        this.aiOrCacheMs = aiOrCacheMs;
        this.persistenceMs = persistenceMs;
        this.totalMs = totalMs;
        this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
}
