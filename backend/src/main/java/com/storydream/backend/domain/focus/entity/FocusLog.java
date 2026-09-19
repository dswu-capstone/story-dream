package com.storydream.backend.domain.focus.entity;

import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.global.common.PartType;
import com.storydream.backend.global.converter.PartTypeConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Duration;
import java.time.LocalDateTime;

@Entity
@Table(name = "focus_log", uniqueConstraints = @UniqueConstraint(
        name = "uk_focus_log_history_event", columnNames = {"reading_history_id", "event_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FocusLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reading_history_id", nullable = false)
    private ReadingHistory readingHistory;

    // 과거 로그는 null을 유지한다. 새 API에서는 확정된 이탈 구간 ID를 필수로 저장한다.
    @Column(name = "event_id", length = 128)
    private String eventId;

    @Convert(converter = PartTypeConverter.class)
    @Column(name = "part_type", nullable = false, length = 20)
    private PartType partType;

    @Column(nullable = false)
    private Integer level;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private FocusEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FocusStatus state;

    @Column(length = 255)
    private String detail;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "duration_sec")
    private Integer durationSec;

    @Column(name = "created_at", updatable = false, insertable = false)
    private LocalDateTime createdAt;

    @Builder
    private FocusLog(ReadingHistory readingHistory, PartType partType, Integer level,
                     FocusEventType eventType, FocusStatus state, String detail,
                     LocalDateTime startedAt, String eventId, Integer durationSec) {
        this.readingHistory = readingHistory;
        this.partType = partType;
        this.level = level;
        this.eventType = eventType;
        this.state = state;
        this.detail = detail != null && detail.length() > 255 ? detail.substring(0, 255) : detail;
        this.startedAt = startedAt;
        this.eventId = eventId;
        this.durationSec = durationSec;
    }

    public void close(LocalDateTime recoveredAt) {
        if (this.endedAt != null) return;
        if (recoveredAt.isBefore(this.startedAt)) return;
        // 이미 확인된 이탈 시간보다 짧게 닫아 확정 이벤트를 훼손하지 않는다.
        if (durationSec != null && recoveredAt.isBefore(startedAt.plusSeconds(durationSec))) return;
        this.endedAt = recoveredAt;
        this.durationSec = (int) Duration.between(this.startedAt, recoveredAt).toSeconds();
    }

    public boolean isOpen() {
        return this.endedAt == null;
    }
}
