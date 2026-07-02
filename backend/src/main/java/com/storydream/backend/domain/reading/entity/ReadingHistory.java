package com.storydream.backend.domain.reading.entity;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.story.entity.OriginalStory;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "reading_history")
public class ReadingHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "child_id", nullable = false)
    private Child child;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_story_id", nullable = false)
    private OriginalStory originalStory;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReadingStatus status;

    @Column(name = "last_sentence_idx")
    private Integer lastSentenceIdx;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    private ReadingHistory(
            Child child,
            OriginalStory originalStory
    ) {
        LocalDateTime now = LocalDateTime.now();

        this.child = child;
        this.originalStory = originalStory;
        this.startedAt = now;
        this.status = ReadingStatus.IN_PROGRESS;
        this.lastSentenceIdx = 0;
        this.createdAt = now;
        this.updatedAt = now;
    }
}