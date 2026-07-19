package com.storydream.backend.domain.report.event;

import com.storydream.backend.domain.report.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 독서 종료 트랜잭션이 '커밋된 뒤'에, '별도 스레드'에서 리포트를 만든다.
 * - AFTER_COMMIT : 롤백된 독서로 리포트가 생기는 걸 막는다.
 * - @Async       : 아이 화면이 GPT 응답을 기다리지 않는다.
 * 리포트 생성이 실패해도 독서 종료 자체는 성공으로 남아야 하므로 예외를 삼키고 로그만 남긴다.
 */
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