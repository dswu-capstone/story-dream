package com.storydream.backend.domain.story.dto;

import java.util.List;

public record StoryPartResponse(
        String type,
        Integer orderNum,
        List<StoryPageResponse> pages
) {
}
