package com.storydream.backend.domain.story.dto;

import java.util.List;

// record: 필드 선언만으로 여러 메서드와 생성자 자동 생성
public record StoryRecommendationResponse (
    List<StorySummary> stories,
    PageInfo pageInfo
) {
    public record StorySummary(
            Integer originalStoryId,
            String title
    ) { }

    public record PageInfo(
            Integer page,
            Integer size,
            Integer totalPages,
            Long totalElements,
            boolean hasNext,
            boolean hasPrevious
    ){ }
}
