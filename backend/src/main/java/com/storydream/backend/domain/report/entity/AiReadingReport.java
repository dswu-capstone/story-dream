package com.storydream.backend.domain.report.entity;

import com.storydream.backend.domain.reading.entity.ReadingHistory;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "ai_reading_report")
public class AiReadingReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reading_history_id", nullable = false, unique = true)
    private ReadingHistory readingHistory;

    @Column(name = "average_quiz_score", nullable = false)
    private BigDecimal averageQuizScore;

    @Column(name = "total_quiz_count", nullable = false)
    private Integer totalQuizCount;

    @Column(name = "correct_quiz_count", nullable = false)
    private Integer correctQuizCount;

    @Column(name = "reading_seconds", nullable = false)
    private Integer readingSeconds;

    @Column(name = "start_level")
    private Integer startLevel;

    @Column(name = "end_level")
    private Integer endLevel;

    @Column(name = "focus_loss_count")
    private Integer focusLossCount;

    @Column(name = "away_seconds")
    private Integer awaySeconds;

    @Column(name = "ai_summary", nullable = false, columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "ai_generated", nullable = false)
    private Boolean aiGenerated;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "report", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AiReadingReportPart> parts = new ArrayList<>();

    @Builder
    private AiReadingReport(
            ReadingHistory readingHistory,
            BigDecimal averageQuizScore,
            Integer totalQuizCount,
            Integer correctQuizCount,
            Integer readingSeconds,
            Integer startLevel,
            Integer endLevel,
            Integer focusLossCount,
            Integer awaySeconds,
            String aiSummary,
            Boolean aiGenerated
    ) {
        LocalDateTime now = LocalDateTime.now();

        this.readingHistory = readingHistory;
        this.averageQuizScore = averageQuizScore;
        this.totalQuizCount = totalQuizCount;
        this.correctQuizCount = correctQuizCount;
        this.readingSeconds = readingSeconds;
        this.startLevel = startLevel;
        this.endLevel = endLevel;
        this.focusLossCount = focusLossCount;
        this.awaySeconds = awaySeconds;
        this.aiSummary = aiSummary;
        this.aiGenerated = aiGenerated;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void addPart(AiReadingReportPart part) {
        this.parts.add(part);
        part.assignReport(this);
    }
}