package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.report.dto.PeriodSummaryResponse;
import com.storydream.backend.domain.report.dto.ReadingHistoryListResponse;
import com.storydream.backend.domain.report.dto.StoryReportResponse;

import java.time.LocalDate;

public interface ReportService {

    /** 독서 완료 시 1회 생성 (이벤트 리스너에서 호출) */
    void generateStoryReport(Integer readingHistoryId);

    /** 화면3 : 동화 1권 리포트 */
    StoryReportResponse getStoryReport(Integer guardianId, Integer readingHistoryId);

    /** 화면2·3 사이드바 : 독서 이력 목록 */
    ReadingHistoryListResponse getReadingHistories(
            Integer guardianId,
            Integer childId,
            LocalDate from,
            LocalDate to
    );

    /** 화면2 : 전체 독서 요약 */
    PeriodSummaryResponse getPeriodSummary(
            Integer guardianId,
            Integer childId,
            LocalDate from,
            LocalDate to
    );
}