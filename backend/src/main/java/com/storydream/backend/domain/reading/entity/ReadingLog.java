package com.storydream.backend.domain.reading.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "reading_log")
public class ReadingLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reading_history_id", nullable = false)
    private ReadingHistory readingHistory;

    @Column(name = "part_type", nullable = false, length = 20)
    private String partType;

    @Column(nullable = false)
    private Integer level;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Builder
    private ReadingLog(
            ReadingHistory readingHistory,
            String partType,
            Integer level
    ) {
        this.readingHistory = readingHistory;
        this.partType = partType;
        this.level = level;
        this.createdAt = LocalDateTime.now();
    }
}