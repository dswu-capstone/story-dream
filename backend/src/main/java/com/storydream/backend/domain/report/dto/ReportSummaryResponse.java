package com.storydream.backend.domain.report.dto;

import com.storydream.backend.domain.report.entity.AiReadingReport;

import java.time.LocalDate;

public record ReportSummaryResponse(
        Integer reportId,
        Integer readingHistoryId,
        Integer storyId,
        String storyTitle,
        String coverImageUrl,
        LocalDate completedDate,
        double averageQuizScore,
        Integer endLevel
) {
    public static ReportSummaryResponse from(AiReadingReport r) {
        var history = r.getReadingHistory();
        var story = history.getOriginalStory();
        return new ReportSummaryResponse(
                r.getId(),
                history.getId(),
                story.getId(),
                story.getTitle(),
                story.getCoverImageUrl(),
                history.getEndedAt() == null ? null : history.getEndedAt().toLocalDate(),
                r.getAverageQuizScore().doubleValue(),
                r.getEndLevel()
        );
    }
}
