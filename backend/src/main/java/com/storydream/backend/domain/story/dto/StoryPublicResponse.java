package com.storydream.backend.domain.story.dto;

import java.util.List;

public record StoryPublicResponse(
        List<StoryPublic> stories,
        PageInfo pageInfo
) {

    public record StoryPublic(
            Integer originalStoryId,
            String title,
            List<String> tags,
            String coverImageUrl
    ) {}

    public record PageInfo(
            Integer page,
            Integer size,
            Integer totalPages,
            Long totalElements,
            boolean hasNext,
            boolean hasPrevious
    ){ }
}