package com.storydream.backend.domain.report.client;

import java.time.LocalDate;
import java.util.List;

public record AiPeriodSummaryRequest(
        String childName,
        LocalDate periodStart,
        LocalDate periodEnd,
        int totalReadingCount,
        Double averageQuizScore,
        Double averageFocusRate,
        List<WeeklyPayload> weeklyScores
) {
    public record WeeklyPayload(
            String label,
            int readingCount,
            Double averageQuizScore
    ) {}
}
