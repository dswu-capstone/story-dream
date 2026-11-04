package com.storydream.backend.domain.recommendation.repository.projection;

public interface StoryEventCountProjection {
    Integer getOriginalStoryId();
    long getEventCount();
}
