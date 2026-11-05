package com.storydream.backend.domain.recommendation.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Entity
@Getter
@Table(
        name = "recommendation_exposure",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_recommendation_exposure_session",
                columnNames = {"recommendation_item_id", "view_session_id"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecommendationExposure {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_item_id", nullable = false)
    private RecommendationItem recommendationItem;

    @Column(name = "view_session_id", nullable = false, length = 128)
    private String viewSessionId;

    @Column(name = "exposed_at", nullable = false, updatable = false)
    private OffsetDateTime exposedAt;

    public RecommendationExposure(
            RecommendationItem recommendationItem,
            String viewSessionId
    ) {
        this.recommendationItem = recommendationItem;
        this.viewSessionId = viewSessionId;
        this.exposedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
}
