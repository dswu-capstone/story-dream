package com.storydream.backend.domain.recommendation.dto;

public record RecommendationExposureResponse(
        Long recommendationExposureId,
        boolean alreadyProcessed
) {
}
