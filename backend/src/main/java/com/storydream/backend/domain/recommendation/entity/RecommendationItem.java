package com.storydream.backend.domain.recommendation.entity;

import com.storydream.backend.domain.story.entity.OriginalStory;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@Table(
        name = "recommendation_item",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_recommendation_item_story",
                        columnNames = {"recommendation_id", "original_story_id"}
                ),
                @UniqueConstraint(
                        name = "uk_recommendation_item_rank",
                        columnNames = {"recommendation_id", "rank"}
                )
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecommendationItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_id", nullable = false)
    private Recommendation recommendation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "original_story_id", nullable = false)
    private OriginalStory originalStory;

    @Column(nullable = false)
    private Integer rank;

    @Column(nullable = false)
    private Double score;

    @Column(name = "interest_score", nullable = false)
    private Double interestScore;

    @Column(name = "behavior_score", nullable = false)
    private Double behaviorScore;

    @Column(name = "behavior_applied", nullable = false)
    private Boolean behaviorApplied;

    public RecommendationItem(
            Recommendation recommendation,
            OriginalStory originalStory,
            Integer rank,
            Double score,
            Double interestScore,
            Double behaviorScore,
            Boolean behaviorApplied
    ) {
        this.recommendation = recommendation;
        this.originalStory = originalStory;
        this.rank = rank;
        this.score = score;
        this.interestScore = interestScore;
        this.behaviorScore = behaviorScore;
        this.behaviorApplied = behaviorApplied;
    }
}
