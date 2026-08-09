package com.storydream.backend.domain.story.dto;

import java.util.List;

public record AiRecommendationResponse(
        List<AiRecommendedStory> recommendations
) {
}