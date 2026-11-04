package com.storydream.backend.domain.recommendation.repository.projection;

import java.time.LocalDateTime;

public interface StoryReadingCountProjection {
    Integer getOriginalStoryId();
    long getReadingStartCount();
    long getReadingCompletionCount();
    LocalDateTime getLatestReadingStartedAt();
    LocalDateTime getLatestReadingCompletedAt();
}
