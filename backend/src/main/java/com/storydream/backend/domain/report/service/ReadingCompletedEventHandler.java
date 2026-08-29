package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.report.event.ReadingCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReadingCompletedEventHandler {

    private final ReportGenerationFacade facade;

    @Async("reportTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ReadingCompletedEvent event) {
        try {
            facade.generate(event.readingHistoryId());
        } catch (Exception e) {
            log.error("리포트 생성 실패. readingHistoryId={}", event.readingHistoryId(), e);
        }
    }
}
