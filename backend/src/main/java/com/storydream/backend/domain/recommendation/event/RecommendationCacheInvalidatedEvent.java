package com.storydream.backend.domain.recommendation.event;

import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;

public record RecommendationCacheInvalidatedEvent(
        Integer childId,
        String languageCode,
        RecommendationInvalidationReason reason
) {
}
