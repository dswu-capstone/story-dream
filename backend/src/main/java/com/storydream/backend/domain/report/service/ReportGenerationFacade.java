//package com.storydream.backend.domain.report.service;
//
//import com.storydream.backend.domain.report.client.AiReportClient;
//import com.storydream.backend.domain.report.client.AiSummaryRequest;
//import lombok.RequiredArgsConstructor;
//import lombok.extern.slf4j.Slf4j;
//import org.springframework.stereotype.Service;
//
//@Slf4j
//@Service
//@RequiredArgsConstructor
//public class ReportGenerationFacade {
//
//    private final AiReadingReportGenerator generator;
//    private final AiReportClient aiReportClient;
//
//    public Integer generate(Integer readingHistoryId) {
//        Integer reportId = generator.createDraft(readingHistoryId);
//        try {
//            AiSummaryRequest request = generator.buildRequest(reportId);
//            String summary = aiReportClient.generateSummary(request);
//            generator.completeReport(reportId, summary);
//            log.info("AI 리포트 생성 완료. reportId={}", reportId);
//        } catch (Exception e) {
//            log.error("AI 리포트 요약 생성 실패. reportId={}", reportId, e);
//            generator.failReport(reportId, e.getMessage());
//        }
//        return reportId;
//    }
//}


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

    private static final String FALLBACK_SUMMARY =
            "AI 코멘트를 생성하지 못했어요. 아래 지표를 확인해주세요.";

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
            log.error("AI 리포트 요약 생성 실패. 기본 문구로 대체. reportId={}", reportId, e);
            generator.completeReport(reportId, FALLBACK_SUMMARY);
        }
        return reportId;
    }
}