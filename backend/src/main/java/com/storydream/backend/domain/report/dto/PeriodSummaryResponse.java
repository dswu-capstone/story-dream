package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

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