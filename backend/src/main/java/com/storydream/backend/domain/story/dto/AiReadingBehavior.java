package com.storydream.backend.domain.story.dto;

import java.time.OffsetDateTime;

public record AiReadingBehavior(
        Integer originalStoryId,
        long exposureCount,
        long clickCount,
        long readingStartCount,
        long bodyCompletionCount,
        long readingCompletionCount,
        OffsetDateTime latestPositiveEventAt
) {
}
