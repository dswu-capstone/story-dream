package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record WeeklyScoreResponse(
        Integer weekIndex,            // 0부터
        LocalDate weekStart,
        LocalDate weekEnd,
        String label,                
        BigDecimal averageQuizScore,
        Integer readingCount
) {
}