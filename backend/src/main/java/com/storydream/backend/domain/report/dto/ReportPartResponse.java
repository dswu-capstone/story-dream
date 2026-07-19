package com.storydream.backend.domain.report.dto;

import java.math.BigDecimal;

public record ReportPartResponse(
        String partType,          // 서론 / 본론 / 결론
        Integer orderNum,         // 1, 2, 3
        Integer level,            // 1 ~ 3
        BigDecimal quizScore,     // 0 ~ 100
        Integer quizCorrectCount,
        Integer quizTotalCount,
        Integer focusLossCount    // 이탈 로그 연동 전이면 null
) {
}