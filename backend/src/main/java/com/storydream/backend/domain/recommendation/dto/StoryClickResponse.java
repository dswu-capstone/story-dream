package com.storydream.backend.domain.recommendation.dto;

public record StoryClickResponse(
        Long storyClickId,
        boolean alreadyProcessed
) {
}
