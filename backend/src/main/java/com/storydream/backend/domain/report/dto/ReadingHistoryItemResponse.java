package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/* "독서 이력" 목록의 한 줄 */
public record ReadingHistoryItemResponse(
        Integer readingHistoryId,
        Integer originalStoryId,
        String storyTitle,
        LocalDate completedAt,
        BigDecimal averageQuizScore
) {
}