package com.storydream.backend.domain.story.service;

import com.storydream.backend.domain.story.dto.StoryDetailResponse;
import com.storydream.backend.domain.story.dto.StoryPublicResponse;
import com.storydream.backend.domain.story.dto.StoryRecommendationResponse;

public interface StoryService {
    StoryPublicResponse getPublicStories(
            String languageCode,
            Integer page,
            Integer size
    );

    StoryRecommendationResponse getRecommendations(
            Integer guardianId,
            Integer childId,
            String languageCode,
            Integer page,
            Integer size
    );

    StoryDetailResponse getStoryDetail(
            Integer originalStoryId,
            Integer level
    );
}
