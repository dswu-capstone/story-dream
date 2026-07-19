package com.storydream.backend.domain.report.service;

import java.math.BigDecimal;
import java.util.List;

public record ReportFacts(
        Integer readingHistoryId,
        Integer childId,
        String childName,
        Integer childAge,
        String storyTitle,
        int readingSeconds,
        int totalQuizCount,
        int correctQuizCount,
        BigDecimal averageQuizScore,
        Integer startLevel,
        Integer endLevel,
        Integer focusLossCount,
        List<PartFact> parts
) {
}