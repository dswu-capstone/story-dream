package com.storydream.backend.domain.story.dto;

public record AiRecommendedStory(
        Integer originalStoryId,
        String title,
        String languageCode,
        double score // python의 float: 64비트, Java의 float: 32비트, double: 64비트
) {
}
