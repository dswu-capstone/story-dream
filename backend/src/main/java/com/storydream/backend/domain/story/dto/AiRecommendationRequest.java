package com.storydream.backend.domain.story.dto;

import java.util.List;

public record AiRecommendationRequest(
        String[] interests,
        String languageCode,
        List<AiReadingBehavior> readingBehaviors
) {}
