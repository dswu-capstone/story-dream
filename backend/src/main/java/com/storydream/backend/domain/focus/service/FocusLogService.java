package com.storydream.backend.domain.focus.service;

import com.storydream.backend.domain.focus.dto.FocusEventRequest;
import com.storydream.backend.domain.focus.dto.FocusEventResponse;
import com.storydream.backend.domain.focus.entity.FocusEventType;
import com.storydream.backend.domain.focus.entity.FocusLog;
import com.storydream.backend.domain.focus.entity.FocusStatus;
import com.storydream.backend.domain.focus.repository.FocusLogRepository;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.global.common.PartType;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Set;

import static com.storydream.backend.domain.focus.dto.FocusEventResponse.Status.*;

@Service
@RequiredArgsConstructor
public class FocusLogService {
    private final FocusLogRepository focusLogRepository;
    private final ReadingHistoryRepository readingHistoryRepository;
    private final ReadingLogRepository readingLogRepository;

    @Transactional
    public FocusEventResponse handleEvent(Integer readingHistoryId, FocusEventRequest request) {
        validateRequest(request);

        // 퀴즈/next-part와 같은 부모 행 잠금: 여러 서버에서도 중복 확인과 저장을 직렬화한다.
        ReadingHistory history = readingHistoryRepository.findByIdForUpdate(readingHistoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND));
        FocusLog existing = focusLogRepository
                .findByReadingHistoryIdAndEventId(readingHistoryId, request.eventId())
                .orElse(null);

        if ("focus_recovered".equals(request.effectiveEventType())) {
            return recover(existing, request);
        }
        // 파트가 전환된 후 재시도해도 최초 귀속과 내용을 유지한다.
        if (existing != null) {
            return new FocusEventResponse(existing.getId(), ALREADY_PROCESSED);
        }

        ReadingLog current = readingLogRepository.findTopByReadingHistoryIdOrderByIdDesc(readingHistoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.READING_LOG_NOT_FOUND));
        PartType partType;
        try {
            partType = PartType.fromDbValue(current.getPartType());
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.INVALID_PART_TYPE);
        }

        boolean absent = "absent".equals(request.effectiveEventType());
        FocusLog log = FocusLog.builder()
                .readingHistory(history)
                .partType(partType)
                .level(current.getLevel())
                .eventId(request.eventId())
                .eventType(absent ? FocusEventType.ABSENT : FocusEventType.FOCUS_LOST)
                .state(absent ? FocusStatus.ABSENT : FocusStatus.DISTRACTED)
                .startedAt(request.occurredAt().minusSeconds(request.durationSeconds()))
                .durationSec(request.durationSeconds())
                .build();
        FocusLog saved = focusLogRepository.saveAndFlush(log);
        return new FocusEventResponse(saved.getId(), SAVED);
    }

    private FocusEventResponse recover(FocusLog existing, FocusEventRequest request) {
        if (existing == null) {
            throw new BusinessException(ErrorCode.FOCUS_EVENT_NOT_FOUND);
        }
        if (!existing.isOpen()) {
            return new FocusEventResponse(existing.getId(), ALREADY_PROCESSED);
        }
        long duration = Duration.between(existing.getStartedAt(), request.occurredAt()).toSeconds();
        if (duration < existing.getDurationSec() || duration != request.durationSeconds()) {
            throw new BusinessException(ErrorCode.INVALID_FOCUS_EVENT);
        }
        existing.close(request.occurredAt());
        return new FocusEventResponse(existing.getId(), RECOVERED);
    }

    private void validateRequest(FocusEventRequest request) {
        if (request == null || request.eventId() == null || request.eventId().isBlank()
                || request.eventId().length() > 128 || !request.eventId().matches("\\S+")
                || request.occurredAt() == null || request.durationSeconds() == null
                || request.durationSeconds() < 10
                || !Set.of("focus_lost", "absent", "focus_recovered").contains(request.effectiveEventType())) {
            throw new BusinessException(ErrorCode.INVALID_FOCUS_EVENT);
        }
    }

    @Transactional
    public void closeAllOpen(Integer readingHistoryId, LocalDateTime endedAt) {
        // 기존 독서 종료/리포트 경로를 유지하고 이벤트 저장과 동일한 잠금을 사용한다.
        readingHistoryRepository.findByIdForUpdate(readingHistoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND));
        focusLogRepository.findAllByReadingHistoryIdAndEndedAtIsNull(readingHistoryId)
                .forEach(log -> log.close(endedAt));
    }
}