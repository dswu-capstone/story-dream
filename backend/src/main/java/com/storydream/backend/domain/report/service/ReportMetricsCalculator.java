package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.report.dto.ReportMetrics;
import com.storydream.backend.domain.report.entity.AiReportPartDetail;
import com.storydream.backend.domain.report.repository.projection.PartFocusStat;
import com.storydream.backend.domain.report.repository.projection.PartQuizStat;
import com.storydream.backend.global.common.PartType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class ReportMetricsCalculator {

    public ReportMetrics calculate(LocalDateTime startedAt,
                                   LocalDateTime endedAt,
                                   List<ReadingLog> readingLogs,
                                   List<PartQuizStat> quizStats,
                                   List<PartFocusStat> focusStats) {

        int totalReadingSec = toSeconds(startedAt, endedAt);

        Map<PartType, Integer> levelByPart = readingLogs.stream()
                .collect(Collectors.toMap(
//                        ReadingLog::getPartType,
                        rl -> PartType.fromDbValue(rl.getPartType()),
                        ReadingLog::getLevel,
                        (oldV, newV) -> newV,
                        () -> new EnumMap<>(PartType.class)));

        Map<PartType, PartQuizStat> quizByPart = quizStats.stream()
                .collect(Collectors.toMap(
                        s -> PartType.fromDbValue(s.getPartType()), Function.identity()));

        Map<PartType, PartFocusStat> focusByPart = focusStats.stream()
                .collect(Collectors.toMap(
                        s -> PartType.fromDbValue(s.getPartType()), Function.identity()));

        List<AiReportPartDetail> parts = new ArrayList<>();
        int totalQuiz = 0, correctQuiz = 0, distractionCount = 0, distractionSec = 0;

        for (PartType part : PartType.values()) {
            Integer level = levelByPart.get(part);
            if (level == null) continue;

            PartQuizStat quiz = quizByPart.get(part);
            PartFocusStat focus = focusByPart.get(part);

            int qTotal = quiz == null ? 0 : quiz.getTotalCount().intValue();
            int qCorrect = quiz == null ? 0 : quiz.getCorrectCount().intValue();
            int dCount = focus == null ? 0 : focus.getDistractionCount().intValue();
            int dSec = focus == null ? 0 : focus.getDistractionSec().intValue();

            parts.add(AiReportPartDetail.builder()
                    .partType(part)
                    .level(level)
                    .quizTotal(qTotal)
                    .quizCorrect(qCorrect)
                    .distractionCount(dCount)
                    .distractionSec(dSec)
                    .build());

            totalQuiz += qTotal;
            correctQuiz += qCorrect;
            distractionCount += dCount;
            distractionSec += dSec;
        }

        return new ReportMetrics(
                totalReadingSec,
                totalQuiz,
                correctQuiz,
                percentage(correctQuiz, totalQuiz),
                parts.isEmpty() ? null : parts.get(0).getLevel(),
                parts.isEmpty() ? null : parts.get(parts.size() - 1).getLevel(),
                distractionCount,
                distractionSec,
                focusRate(totalReadingSec, distractionSec),
                parts
        );
    }

    private int toSeconds(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) return 0;
        long sec = Duration.between(start, end).toSeconds();
        return sec < 0 ? 0 : (int) sec;
    }

    private BigDecimal percentage(int part, int total) {
        if (total <= 0) return BigDecimal.ZERO.setScale(1);
        return BigDecimal.valueOf(part)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    private BigDecimal focusRate(int totalSec, int distractedSec) {
        if (totalSec <= 0) return null;
        BigDecimal rate = BigDecimal.valueOf(totalSec - distractedSec)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(totalSec), 1, RoundingMode.HALF_UP);
        return rate.max(BigDecimal.ZERO).min(BigDecimal.valueOf(100));
    }
}