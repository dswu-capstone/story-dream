package com.storydream.backend.domain.story.dto;

public record AiRecommendationRequest(
        String[] interests,
        String languageCode
) {}
