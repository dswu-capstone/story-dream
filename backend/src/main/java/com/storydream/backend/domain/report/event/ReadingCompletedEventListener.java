package com.storydream.backend.domain.report.event;

import com.storydream.backend.domain.report.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;


@Slf4j
@Component
@RequiredArgsConstructor
public class ReadingCompletedEventListener {

    private final ReportService reportService;

    @Async("reportExecutor")
    @TransactionalEventListener
    public void handle(ReadingCompletedEvent event) {
        try {
            reportService.generateStoryReport(event.readingHistoryId());
        } catch (Exception e) {
            log.error("[AI 리포트] 생성 실패. readingHistoryId={}", event.readingHistoryId(), e);
        }
    }
}