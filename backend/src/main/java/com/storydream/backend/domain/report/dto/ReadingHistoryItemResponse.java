package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 화면2·3 왼쪽 사이드바 "독서 이력" 목록의 한 줄 */
public record ReadingHistoryItemResponse(
        Integer readingHistoryId,
        Integer originalStoryId,
        String storyTitle,
        LocalDate completedAt,
        BigDecimal averageQuizScore
) {
}