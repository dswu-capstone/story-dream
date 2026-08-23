package com.storydream.backend.domain.report.controller;

import com.storydream.backend.domain.report.dto.ReportDetailResponse;
import com.storydream.backend.domain.report.dto.ReportOverviewResponse;
import com.storydream.backend.domain.report.dto.ReportSummaryResponse;
import com.storydream.backend.domain.report.service.AiReadingReportQueryService;
import com.storydream.backend.domain.report.service.ReportGenerationFacade;
import com.storydream.backend.domain.report.service.ReportOverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AiReadingReportController {

    private final AiReadingReportQueryService queryService;
    private final ReportOverviewService overviewService;
    private final ReportGenerationFacade generationFacade;

    @GetMapping("/children/{childId}/reading-reports/overview")
    public ResponseEntity<ReportOverviewResponse> getOverview(
            @RequestHeader("X-Guardian-Id") Integer guardianId,
            @PathVariable Integer childId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        return ResponseEntity.ok(
                overviewService.getOverview(guardianId, childId, from, to));
    }

    @GetMapping("/children/{childId}/reading-reports")
    public ResponseEntity<Page<ReportSummaryResponse>> getReports(
            @RequestHeader("X-Guardian-Id") Integer guardianId,
            @PathVariable Integer childId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @PageableDefault(size = 20) Pageable pageable) {

        return ResponseEntity.ok(
                queryService.getReports(guardianId, childId, from, to, pageable));
    }

    @GetMapping("/reading-reports/{reportId}")
    public ResponseEntity<ReportDetailResponse> getReportDetail(
            @RequestHeader("X-Guardian-Id") Integer guardianId,
            @PathVariable Integer reportId) {

        return ResponseEntity.ok(
                queryService.getReportDetail(guardianId, reportId));
    }

    @PostMapping("/reading-histories/{historyId}/reading-report")
    public ResponseEntity<Integer> regenerate(@PathVariable Integer historyId) {
        return ResponseEntity.ok(generationFacade.generate(historyId));
    }
}