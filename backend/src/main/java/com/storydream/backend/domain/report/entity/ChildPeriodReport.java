package com.storydream.backend.domain.report.entity;

import com.storydream.backend.domain.child.entity.Child;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 화면2 "전체 요약" 탭의 AI 종합 분석 캐시. (아이 + 기간) 단위. */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "child_period_report")
public class ChildPeriodReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "child_id", nullable = false)
    private Child child;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "reading_count", nullable = false)
    private Integer readingCount;

    @Column(name = "average_quiz_score", nullable = false)
    private BigDecimal averageQuizScore;

    @Column(name = "total_reading_seconds", nullable = false)
    private Integer totalReadingSeconds;

    @Column(name = "ai_summary", nullable = false, columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "ai_generated", nullable = false)
    private Boolean aiGenerated;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    private ChildPeriodReport(
            Child child,
            LocalDate periodStart,
            LocalDate periodEnd,
            Integer readingCount,
            BigDecimal averageQuizScore,
            Integer totalReadingSeconds,
            String aiSummary,
            Boolean aiGenerated
    ) {
        LocalDateTime now = LocalDateTime.now();

        this.child = child;
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
        this.readingCount = readingCount;
        this.averageQuizScore = averageQuizScore;
        this.totalReadingSeconds = totalReadingSeconds;
        this.aiSummary = aiSummary;
        this.aiGenerated = aiGenerated;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** 기간 내 완독 수가 그대로면 GPT를 다시 부르지 않고 캐시된 요약을 쓴다. */
    public boolean isFresh(int currentReadingCount) {
        return this.readingCount == currentReadingCount;
    }

    public void refresh(
            Integer readingCount,
            BigDecimal averageQuizScore,
            Integer totalReadingSeconds,
            String aiSummary,
            Boolean aiGenerated
    ) {
        this.readingCount = readingCount;
        this.averageQuizScore = averageQuizScore;
        this.totalReadingSeconds = totalReadingSeconds;
        this.aiSummary = aiSummary;
        this.aiGenerated = aiGenerated;
        this.updatedAt = LocalDateTime.now();
    }
}