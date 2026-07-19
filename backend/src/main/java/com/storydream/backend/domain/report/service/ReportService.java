package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.report.dto.PeriodSummaryResponse;
import com.storydream.backend.domain.report.dto.ReadingHistoryListResponse;
import com.storydream.backend.domain.report.dto.StoryReportResponse;

import java.time.LocalDate;

public interface ReportService {

    void generateStoryReport(Integer readingHistoryId);

    StoryReportResponse getStoryReport(Integer guardianId, Integer readingHistoryId);

    ReadingHistoryListResponse getReadingHistories(
            Integer guardianId,
            Integer childId,
            LocalDate from,
            LocalDate to
    );

    PeriodSummaryResponse getPeriodSummary(
            Integer guardianId,
            Integer childId,
            LocalDate from,
            LocalDate to
    );
}