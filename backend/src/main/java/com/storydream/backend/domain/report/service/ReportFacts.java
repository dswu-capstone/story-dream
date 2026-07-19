package com.storydream.backend.domain.report.service;

import java.math.BigDecimal;
import java.util.List;

/** 동화 1회 독서의 집계 결과. AI 프롬프트 입력이자 저장 입력. */
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