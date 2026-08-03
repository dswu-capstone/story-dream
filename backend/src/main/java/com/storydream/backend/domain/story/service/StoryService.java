package com.storydream.backend.domain.story.service;

import com.storydream.backend.domain.story.dto.StoryDetailResponse;
import com.storydream.backend.domain.story.dto.StoryPartResponse;
import com.storydream.backend.domain.story.dto.StoryRecommendationResponse;
import com.storydream.backend.domain.story.entity.StoryPart;

public interface StoryService {
    StoryRecommendationResponse getRecommendations(
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
