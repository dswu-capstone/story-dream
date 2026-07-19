package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record StoryReportResponse(
        Integer readingHistoryId,
        Integer childId,
        String childName,
        Integer originalStoryId,
        String storyTitle,
        LocalDate completedAt,
        Integer readingSeconds,
        BigDecimal averageQuizScore,
        Integer startLevel,
        Integer endLevel,
        Integer focusLossCount,
        List<ReportPartResponse> parts,
        String aiSummary
) {
}