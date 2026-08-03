package com.storydream.backend.domain.reading.dto;

import com.storydream.backend.domain.story.dto.StoryDetailResponse;

public record NextPartResponse(
        String partType,
        Integer level,
        boolean levelChanged,
        StoryDetailResponse story
) {
}