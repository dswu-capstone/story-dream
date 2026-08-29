package com.storydream.backend.domain.report.entity;

import com.storydream.backend.domain.child.entity.Child;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "child_period_summary")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChildPeriodSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "child_id", nullable = false)
    private Child child;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "total_reading_count", nullable = false)
    private int totalReadingCount;

    @Column(name = "average_quiz_score", precision = 5, scale = 1)
    private BigDecimal averageQuizScore;

    @Column(name = "average_focus_rate", precision = 5, scale = 1)
    private BigDecimal averageFocusRate;

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportStatus status;

    @Column(name = "source_report_count", nullable = false)
    private int sourceReportCount;

    @Column(name = "created_at", updatable = false, insertable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public static ChildPeriodSummary of(Child child, LocalDate start, LocalDate end) {
        ChildPeriodSummary s = new ChildPeriodSummary();
        s.child = child;
        s.periodStart = start;
        s.periodEnd = end;
        s.status = ReportStatus.PENDING;
        s.sourceReportCount = -1;
        return s;
    }

    public boolean isStale(long currentReportCount) {
        return this.status != ReportStatus.COMPLETED
                || this.sourceReportCount != currentReportCount;
    }

    public void updateStats(int readingCount, BigDecimal avgScore, BigDecimal avgFocus) {
        this.totalReadingCount = readingCount;
        this.averageQuizScore = avgScore;
        this.averageFocusRate = avgFocus;
        this.updatedAt = LocalDateTime.now();
    }

    public void completeWithSummary(String summary, int sourceCount) {
        this.aiSummary = summary;
        this.sourceReportCount = sourceCount;
        this.status = ReportStatus.COMPLETED;
        this.updatedAt = LocalDateTime.now();
    }

    public void fail() {
        this.status = ReportStatus.FAILED;
        this.updatedAt = LocalDateTime.now();
    }
}
