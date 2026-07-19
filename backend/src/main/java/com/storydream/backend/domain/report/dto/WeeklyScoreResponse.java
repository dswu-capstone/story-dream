package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 화면2 꺾은선 그래프의 한 점 (5/1 ~ 5/7, 5/8 ~ 5/14 ...) */
public record WeeklyScoreResponse(
        Integer weekIndex,            // 0부터
        LocalDate weekStart,
        LocalDate weekEnd,
        String label,                 // "5/1 ~ 5/7"
        BigDecimal averageQuizScore,  // 그 주에 완독 기록이 없으면 null → 프론트에서 점 생략
        Integer readingCount
) {
}