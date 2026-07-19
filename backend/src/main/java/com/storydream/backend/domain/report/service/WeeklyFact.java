package com.storydream.backend.domain.report.service;

import java.math.BigDecimal;
import java.time.LocalDate;

public record WeeklyFact(
        int weekIndex,
        LocalDate weekStart,
        LocalDate weekEnd,
        BigDecimal averageQuizScore,  // 기록 없으면 null
        int readingCount
) {
}