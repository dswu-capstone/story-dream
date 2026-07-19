package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.report.entity.PartType;

import java.math.BigDecimal;

/** 문단 하나의 집계 결과 (엔티티가 아닌 순수 값 → 트랜잭션 밖에서도 안전) */
public record PartFact(
        PartType partType,
        int level,
        int quizTotalCount,
        int quizCorrectCount,
        BigDecimal quizScore,
        Integer focusLossCount
) {
}