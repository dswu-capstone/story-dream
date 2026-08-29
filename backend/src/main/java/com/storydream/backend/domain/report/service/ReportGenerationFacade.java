package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.report.client.AiReportClient;
import com.storydream.backend.domain.report.client.AiSummaryRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportGenerationFacade {

    private final AiReadingReportGenerator generator;
    private final AiReportClient aiReportClient;

    public Integer generate(Integer readingHistoryId) {
        Integer reportId = generator.createDraft(readingHistoryId);
        try {
            AiSummaryRequest request = generator.buildRequest(reportId);
            String summary = aiReportClient.generateSummary(request);
            generator.completeReport(reportId, summary);
            log.info("AI 리포트 생성 완료. reportId={}", reportId);
        } catch (Exception e) {
            log.error("AI 리포트 요약 생성 실패. reportId={}", reportId, e);
            generator.failReport(reportId, e.getMessage());
        }
        return reportId;
    }
}