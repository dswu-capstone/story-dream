package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.focus.service.FocusLogService;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.report.event.ReadingCompletedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReadingHistoryService {

    private final ReadingHistoryRepository readingHistoryRepository;
    private final FocusLogService focusLogService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public void complete(Integer readingHistoryId, Integer lastSentenceIdx) {
        ReadingHistory history = readingHistoryRepository.findById(readingHistoryId)
                .orElseThrow(() -> new IllegalArgumentException("독서 이력이 없습니다."));

        history.complete(lastSentenceIdx);

        focusLogService.closeAllOpen(readingHistoryId, history.getEndedAt());
        eventPublisher.publishEvent(new ReadingCompletedEvent(readingHistoryId));
    }
}
