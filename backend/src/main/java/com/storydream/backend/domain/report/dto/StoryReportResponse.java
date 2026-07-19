package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** 화면3 : "토끼와 거북이 리포트" */
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
        List<ReportPartResponse> parts,   // 항상 서론 → 본론 → 결론 순
        String aiSummary
) {
}