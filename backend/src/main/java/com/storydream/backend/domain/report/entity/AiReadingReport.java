package com.storydream.backend.domain.report.entity;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.report.dto.ReportMetrics;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ai_reading_report")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiReadingReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reading_history_id", nullable = false, unique = true)
    private ReadingHistory readingHistory;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "child_id", nullable = false)
    private Child child;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportStatus status;

    @Column(name = "total_reading_sec", nullable = false)
    private int totalReadingSec;

    @Column(name = "total_quiz_count", nullable = false)
    private int totalQuizCount;

    @Column(name = "correct_quiz_count", nullable = false)
    private int correctQuizCount;

    @Column(name = "average_quiz_score", nullable = false, precision = 5, scale = 1)
    private BigDecimal averageQuizScore;

    @Column(name = "start_level")
    private Integer startLevel;

    @Column(name = "end_level")
    private Integer endLevel;

    @Column(name = "distraction_count", nullable = false)
    private int distractionCount;

    @Column(name = "distraction_sec", nullable = false)
    private int distractionSec;

    @Column(name = "focus_rate", precision = 5, scale = 1)
    private BigDecimal focusRate;

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "fail_reason", length = 500)
    private String failReason;

    @Column(name = "created_at", updatable = false, insertable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "report", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderNum ASC")
    private List<AiReportPartDetail> parts = new ArrayList<>();

    public static AiReadingReport of(ReadingHistory history, Child child, ReportMetrics m) {
        AiReadingReport report = new AiReadingReport();
        report.readingHistory = history;
        report.child = child;
        report.status = ReportStatus.PROCESSING;
        report.applyMetrics(m);
        return report;
    }

    public void applyMetrics(ReportMetrics m) {
        this.totalReadingSec = m.totalReadingSec();
        this.totalQuizCount = m.totalQuizCount();
        this.correctQuizCount = m.correctQuizCount();
        this.averageQuizScore = m.averageQuizScore();
        this.startLevel = m.startLevel();
        this.endLevel = m.endLevel();
        this.distractionCount = m.distractionCount();
        this.distractionSec = m.distractionSec();
        this.focusRate = m.focusRate();
        this.updatedAt = LocalDateTime.now();
    }

    public void replaceParts(List<AiReportPartDetail> newParts) {
        this.parts.clear();
        newParts.forEach(p -> {
            p.assignReport(this);
            this.parts.add(p);
        });
    }

    public void completeWithSummary(String summary) {
        this.aiSummary = summary;
        this.status = ReportStatus.COMPLETED;
        this.failReason = null;
        this.updatedAt = LocalDateTime.now();
    }

    public void fail(String reason) {
        this.status = ReportStatus.FAILED;
        this.failReason = (reason != null && reason.length() > 500)
                ? reason.substring(0, 500) : reason;
        this.updatedAt = LocalDateTime.now();
    }

    public void markProcessing() {
        this.status = ReportStatus.PROCESSING;
        this.updatedAt = LocalDateTime.now();
    }
}
