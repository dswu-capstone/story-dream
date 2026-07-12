package com.storydream.backend.domain.story.dto;

import java.util.List;

public record StoryDetailResponse(
        Integer originalStoryId,
        Integer storyLevelId,
        String title,
        Integer level,
        List<StoryPartResponse> parts
) {
}
