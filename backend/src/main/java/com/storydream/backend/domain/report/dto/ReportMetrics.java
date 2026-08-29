package com.storydream.backend.domain.report.dto;

import com.storydream.backend.domain.report.entity.AiReportPartDetail;

import java.math.BigDecimal;
import java.util.List;

public record ReportMetrics(
        int totalReadingSec,
        int totalQuizCount,
        int correctQuizCount,
        BigDecimal averageQuizScore,
        Integer startLevel,
        Integer endLevel,
        int distractionCount,
        int distractionSec,
        BigDecimal focusRate,
        List<AiReportPartDetail> parts
) {}
