package com.storydream.backend.domain.recommendation.repository.projection;

import java.time.LocalDateTime;

public interface StoryLocalEventCountProjection extends StoryEventCountProjection {
    LocalDateTime getLatestEventAt();
}
