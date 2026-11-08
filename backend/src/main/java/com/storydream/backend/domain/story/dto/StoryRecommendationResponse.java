package com.storydream.backend.domain.story.dto;

import java.util.List;

public record StoryRecommendationResponse (
        Long recommendationId,
        List<StorySummary> stories,
        PageInfo pageInfo
) {
    public record StorySummary(
            Long recommendationItemId,
            Integer originalStoryId,
            Integer rank,
            String title,
            List<String> tags,
            String coverImageUrl
    ) { }

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