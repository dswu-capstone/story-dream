package com.storydream.backend.domain.report.dto;

import java.time.LocalDate;
import java.util.List;

public record ReportOverviewResponse(
        Integer childId,
        String childName,
        LocalDate periodStart,
        LocalDate periodEnd,
        int totalReadingCount,
        Double averageQuizScore,
        Double averageFocusRate,
        List<WeeklyScorePoint> weeklyScores,
        String aiSummary,
        String summaryStatus
) {
    public record WeeklyScorePoint(
            String label,
            LocalDate weekStart,
            LocalDate weekEnd,
            int readingCount,
            Double averageQuizScore
    ) {}
}
