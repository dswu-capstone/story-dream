package com.storydream.backend.domain.report.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 서론/본론/결론 단위 스냅샷. 화면3의 두 그래프(평균 정답률, 난이도 변화)가 이걸로 그려진다. */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "ai_reading_report_part")
public class AiReadingReportPart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ai_reading_report_id", nullable = false)
    private AiReadingReport report;

    @Convert(converter = PartTypeConverter.class)
    @Column(name = "part_type", nullable = false, length = 20)
    private PartType partType;

    @Column(name = "order_num", nullable = false)
    private Integer orderNum;

    @Column(nullable = false)
    private Integer level;

    @Column(name = "quiz_total_count", nullable = false)
    private Integer quizTotalCount;

    @Column(name = "quiz_correct_count", nullable = false)
    private Integer quizCorrectCount;

    @Column(name = "quiz_score", nullable = false)
    private BigDecimal quizScore;

    @Column(name = "focus_loss_count")
    private Integer focusLossCount;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Builder
    private AiReadingReportPart(
            PartType partType,
            Integer level,
            Integer quizTotalCount,
            Integer quizCorrectCount,
            BigDecimal quizScore,
            Integer focusLossCount
    ) {
        this.partType = partType;
        this.orderNum = partType.getOrderNum();
        this.level = level;
        this.quizTotalCount = quizTotalCount;
        this.quizCorrectCount = quizCorrectCount;
        this.quizScore = quizScore;
        this.focusLossCount = focusLossCount;
        this.createdAt = LocalDateTime.now();
    }

    void assignReport(AiReadingReport report) {
        this.report = report;
    }
}