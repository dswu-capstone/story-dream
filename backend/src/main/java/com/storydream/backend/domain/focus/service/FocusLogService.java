package com.storydream.backend.domain.focus.service;

import com.storydream.backend.domain.focus.dto.FocusEventRequest;
import com.storydream.backend.domain.focus.entity.FocusEventType;
import com.storydream.backend.domain.focus.entity.FocusLog;
import com.storydream.backend.domain.focus.entity.FocusStatus;
import com.storydream.backend.domain.focus.repository.FocusLogRepository;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class FocusLogService {

    private final FocusLogRepository focusLogRepository;
    private final ReadingHistoryRepository readingHistoryRepository;

    @Transactional
    public Integer handleEvent(Integer readingHistoryId, FocusEventRequest request) {
        LocalDateTime occurredAt = request.occurredAt() != null
                ? request.occurredAt() : LocalDateTime.now();

        return switch (request.eventType()) {
            case "focus_lost" -> open(readingHistoryId, request, FocusEventType.FOCUS_LOST, occurredAt);
            case "absent"     -> open(readingHistoryId, request, FocusEventType.ABSENT, occurredAt);
            case "focus_recovered" -> close(readingHistoryId, occurredAt);
            case "focus_state" -> null;
            default -> {
                log.warn("알 수 없는 focus eventType: {}", request.eventType());
                yield null;
            }
        };
    }

    private Integer open(Integer readingHistoryId, FocusEventRequest request,
                         FocusEventType type, LocalDateTime occurredAt) {

        ReadingHistory history = readingHistoryRepository.findById(readingHistoryId)
                .orElseThrow(() -> new IllegalArgumentException("독서 이력이 없습니다. id=" + readingHistoryId));

        LocalDateTime startedAt = occurredAt.minusSeconds(parseElapsedSec(request.detail()));

        FocusLog focusLog = FocusLog.builder()
                .readingHistory(history)
                .partType(request.partType())
                .level(request.level())
                .eventType(type)
                .state(FocusStatus.valueOf(request.state().toUpperCase()))
                .detail(request.detail())
                .startedAt(startedAt)
                .build();

        return focusLogRepository.save(focusLog).getId();
    }

    private Integer close(Integer readingHistoryId, LocalDateTime recoveredAt) {
        return focusLogRepository
                .findFirstByReadingHistoryIdAndEndedAtIsNullOrderByStartedAtDesc(readingHistoryId)
                .map(focusLog -> {
                    focusLog.close(recoveredAt);
                    return focusLog.getId();
                })
                .orElse(null);
    }
    @Transactional
    public void closeAllOpen(Integer readingHistoryId, LocalDateTime endedAt) {
        focusLogRepository.findAllByReadingHistoryIdAndEndedAtIsNull(readingHistoryId)
                .forEach(focusLog -> focusLog.close(endedAt));
    }

    private long parseElapsedSec(String detail) {
        if (detail == null) return 0L;
        int eq = detail.indexOf('=');
        if (eq < 0 || !detail.endsWith("s")) return 0L;
        try {
            return (long) Double.parseDouble(detail.substring(eq + 1, detail.length() - 1));
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
