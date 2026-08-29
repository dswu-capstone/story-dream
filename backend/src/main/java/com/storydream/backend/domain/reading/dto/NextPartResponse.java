package com.storydream.backend.domain.reading.dto;

import com.storydream.backend.domain.story.dto.StoryDetailResponse;

import java.util.List;

public record NextPartResponse(
        String partType,
        Integer partOrderNum,
        Integer level,
        List<PageResponse> pages
) {
}