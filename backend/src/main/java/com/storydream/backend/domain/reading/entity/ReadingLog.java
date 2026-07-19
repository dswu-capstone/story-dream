package com.storydream.backend.domain.reading.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 동화 읽기 중 문단(서론/본론/결론)별 진행 로그.
 * "그 문단을 읽을 당시의 난이도"가 여기 남고, 이게 리포트의 '난이도 변화' 그래프가 된다.
 * 난이도 조절 로직이 다음 구간 레벨을 정한 뒤 이 로그를 남긴다.
 */
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