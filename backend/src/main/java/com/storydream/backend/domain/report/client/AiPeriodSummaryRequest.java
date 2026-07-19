package com.storydream.backend.domain.report.client;

import com.storydream.backend.domain.report.service.PeriodFacts;

import java.time.LocalDate;
import java.util.List;

public record AiPeriodSummaryRequest(
        String childName,
        Integer childAge,
        String periodStart,
        String periodEnd,
        Integer readingCount,
        Double averageQuizScore,
        Integer totalReadingSeconds,
        Integer latestLevel,
        List<String> topStoryTitles,
        List<Weekly> weeklyScores
) {

    public record Weekly(
            String label,
            Double averageQuizScore,
            Integer readingCount
    ) {
    }

    public static AiPeriodSummaryRequest of(
            String childName,
            Integer childAge,
            LocalDate periodStart,
            LocalDate periodEnd,
            PeriodFacts facts
    ) {
        List<Weekly> weeklyScores = facts.weeklyScores().stream()
                .map(week -> new Weekly(
                        week.weekStart() + " ~ " + week.weekEnd(),
                        week.averageQuizScore() == null ? null : week.averageQuizScore().doubleValue(),
                        week.readingCount()
                ))
                .toList();

        return new AiPeriodSummaryRequest(
                childName,
                childAge,
                periodStart.toString(),
                periodEnd.toString(),
                facts.readingCount(),
                facts.averageQuizScore().doubleValue(),
                facts.totalReadingSeconds(),
                facts.latestLevel(),
                facts.topStoryTitles(),
                weeklyScores
        );
    }
}