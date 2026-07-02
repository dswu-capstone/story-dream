package com.storydream.backend.domain.story.service;

import com.storydream.backend.domain.story.dto.StoryRecommendationResponse;

public interface StoryService {
    StoryRecommendationResponse getRecommendations(
            Integer childId,
            String languageCode,
            Integer page,
            Integer size
    );
}
