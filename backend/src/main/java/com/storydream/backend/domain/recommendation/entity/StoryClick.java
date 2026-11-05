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
        name = "story_click",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_story_click_exposure",
                columnNames = "recommendation_exposure_id"
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StoryClick {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_exposure_id", nullable = false)
    private RecommendationExposure recommendationExposure;

    @Column(name = "clicked_at", nullable = false, updatable = false)
    private OffsetDateTime clickedAt;

    public StoryClick(RecommendationExposure recommendationExposure) {
        this.recommendationExposure = recommendationExposure;
        this.clickedAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
}
