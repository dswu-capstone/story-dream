package com.storydream.backend.domain.report.entity;

import com.storydream.backend.global.common.PartType;
import com.storydream.backend.global.converter.PartTypeConverter;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Entity
@Table(name = "ai_report_part_detail")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiReportPartDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ai_reading_report_id", nullable = false)
    private AiReadingReport report;

    @Convert(converter = PartTypeConverter.class)
    @Column(name = "part_type", nullable = false, length = 20)
    private PartType partType;

    @Column(name = "order_num", nullable = false)
    private int orderNum;

    @Column(nullable = false)
    private int level;

    @Column(name = "quiz_total", nullable = false)
    private int quizTotal;

    @Column(name = "quiz_correct", nullable = false)
    private int quizCorrect;

    @Column(nullable = false, precision = 5, scale = 1)
    private BigDecimal accuracy;

    @Column(name = "distraction_count", nullable = false)
    private int distractionCount;

    @Column(name = "distraction_sec", nullable = false)
    private int distractionSec;

    @Builder
    private AiReportPartDetail(PartType partType, int level, int quizTotal, int quizCorrect,
                               int distractionCount, int distractionSec) {
        this.partType = partType;
        this.orderNum = partType.getOrderNum();
        this.level = level;
        this.quizTotal = quizTotal;
        this.quizCorrect = quizCorrect;
        this.accuracy = calcAccuracy(quizCorrect, quizTotal);
        this.distractionCount = distractionCount;
        this.distractionSec = distractionSec;
    }

    private static BigDecimal calcAccuracy(int correct, int total) {
        if (total == 0) return BigDecimal.ZERO.setScale(1);
        return BigDecimal.valueOf(correct)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    void assignReport(AiReadingReport report) {
        this.report = report;
    }
}
