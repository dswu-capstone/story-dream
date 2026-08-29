package com.storydream.backend.domain.quiz.entity;

import com.storydream.backend.domain.reading.entity.ReadingHistory;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "quiz_result")
public class QuizResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reading_history_id", nullable = false)
    private ReadingHistory readingHistory;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_id", nullable = false)
    private Quiz quiz;

    @Column(name = "selected_answer", nullable = false)
    private String selectedAnswer;

    @Column(name = "is_correct", nullable = false)
    private Boolean isCorrect;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Builder
    private QuizResult(
            ReadingHistory readingHistory,
            Quiz quiz,
            String selectedAnswer,
            Boolean isCorrect
    ) {
        this.readingHistory = readingHistory;
        this.quiz = quiz;
        this.selectedAnswer = selectedAnswer;
        this.isCorrect = isCorrect;
        this.createdAt = LocalDateTime.now();
    }
}