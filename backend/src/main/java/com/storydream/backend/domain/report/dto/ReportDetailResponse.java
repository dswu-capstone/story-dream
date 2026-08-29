package com.storydream.backend.domain.report.dto;

import com.storydream.backend.domain.report.entity.AiReadingReport;

import java.time.LocalDate;
import java.util.List;

public record ReportDetailResponse(
        Integer reportId,
        Integer readingHistoryId,
        String storyTitle,
        String coverImageUrl,
        String childName,
        String status,
        LocalDate completedDate,
        int totalReadingSec,
        double averageQuizScore,
        int totalQuizCount,
        int correctQuizCount,
        Integer startLevel,
        Integer endLevel,
        int distractionCount,
        int distractionSec,
        Double focusRate,
        String aiSummary,
        List<PartTrendResponse> parts
) {
    public static ReportDetailResponse from(AiReadingReport r) {
        var history = r.getReadingHistory();
        var story = history.getOriginalStory();
        return new ReportDetailResponse(
                r.getId(),
                history.getId(),
                story.getTitle(),
                story.getCoverImageUrl(),
                r.getChild().getName(),
                r.getStatus().name(),
                history.getEndedAt() == null ? null : history.getEndedAt().toLocalDate(),
                r.getTotalReadingSec(),
                r.getAverageQuizScore().doubleValue(),
                r.getTotalQuizCount(),
                r.getCorrectQuizCount(),
                r.getStartLevel(),
                r.getEndLevel(),
                r.getDistractionCount(),
                r.getDistractionSec(),
                r.getFocusRate() == null ? null : r.getFocusRate().doubleValue(),
                r.getAiSummary(),
                r.getParts().stream().map(PartTrendResponse::from).toList()
        );
    }
}
