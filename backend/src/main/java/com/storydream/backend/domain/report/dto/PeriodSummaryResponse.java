package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** 화면2 : "전체 독서 요약" 탭 */
public record PeriodSummaryResponse(
        Integer childId,
        String childName,
        LocalDate periodStart,
        LocalDate periodEnd,
        Integer readingCount,
        BigDecimal averageQuizScore,
        Integer totalReadingSeconds,
        List<WeeklyScoreResponse> weeklyScores,
        String aiSummary
) {
}