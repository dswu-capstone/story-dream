package com.storydream.backend.domain.story.dto;

import java.util.List;

public record AiRecommendedStory(
        Integer originalStoryId,
        String title,
        String languageCode,
        double score, // python의 float: 64비트, Java의 float: 32비트, double: 64비트
        List<String> tags
) {
}
