package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.report.entity.PartType;

import java.math.BigDecimal;

public record PartFact(
        PartType partType,
        int level,
        int quizTotalCount,
        int quizCorrectCount,
        BigDecimal quizScore,
        Integer focusLossCount
) {
}