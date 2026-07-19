package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.report.dto.ReadingHistoryItemResponse;

import java.math.BigDecimal;
import java.util.List;

/** 기간(전체 요약) 집계 결과 */
public record PeriodFacts(
        int readingCount,
        BigDecimal averageQuizScore,
        int totalReadingSeconds,
        Integer latestLevel,
        List<String> topStoryTitles,
        List<WeeklyFact> weeklyScores,
        List<ReadingHistoryItemResponse> histories
) {
}