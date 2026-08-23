package com.storydream.backend.domain.report.dto;

import com.storydream.backend.domain.report.entity.AiReportPartDetail;

public record PartTrendResponse(
        String partType,
        int orderNum,
        int level,
        double accuracy,
        int quizTotal,
        int quizCorrect,
        int distractionCount,
        int distractionSec
) {
    public static PartTrendResponse from(AiReportPartDetail p) {
        return new PartTrendResponse(
                p.getPartType().getDbValue(),
                p.getOrderNum(),
                p.getLevel(),
                p.getAccuracy().doubleValue(),
                p.getQuizTotal(),
                p.getQuizCorrect(),
                p.getDistractionCount(),
                p.getDistractionSec()
        );
    }
}
