package com.storydream.backend.domain.recommendation.repository.projection;

import java.time.OffsetDateTime;

public interface StoryOffsetEventCountProjection extends StoryEventCountProjection {
    OffsetDateTime getLatestEventAt();
}
