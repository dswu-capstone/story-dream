package com.storydream.backend.domain.recommendation.entity;

import com.storydream.backend.domain.child.entity.Child;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;

@Entity
@Getter
@Table(name = "recommendation")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "child_id", nullable = false)
    private Child child;

    @Column(name = "language_code", nullable = false, length = 20)
    private String languageCode;

    @Column(name = "algorithm_version", nullable = false, length = 50)
    private String algorithmVersion;

    @Column(name = "recommendation_version", nullable = false)
    private Long recommendationVersion;

    @Column(name = "refresh_reason", nullable = false, length = 30)
    private String refreshReason;

    @Column(name = "page_number", nullable = false)
    private Integer pageNumber;

    @Column(name = "page_size", nullable = false)
    private Integer pageSize;

    @Column(name = "input_interests", nullable = false)
    private String[] inputInterests;

    @Column(name = "invalidated_at")
    private OffsetDateTime invalidatedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "invalidation_reason", length = 30)
    private RecommendationInvalidationReason invalidationReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Recommendation(
            Child child,
            String languageCode,
            String algorithmVersion,
            Long recommendationVersion,
            String refreshReason,
            Integer pageNumber,
            Integer pageSize,
            String[] inputInterests
    ) {
        this.child = child;
        this.languageCode = languageCode;
        this.algorithmVersion = algorithmVersion;
        this.recommendationVersion = recommendationVersion;
        this.refreshReason = refreshReason;
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
        this.inputInterests = inputInterests == null
                ? new String[0]
                : Arrays.copyOf(inputInterests, inputInterests.length);
        this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
    }
}
