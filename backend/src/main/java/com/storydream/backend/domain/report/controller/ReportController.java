package com.storydream.backend.domain.report.controller;

import com.storydream.backend.domain.report.dto.PeriodSummaryResponse;
import com.storydream.backend.domain.report.dto.ReadingHistoryListResponse;
import com.storydream.backend.domain.report.dto.StoryReportResponse;
import com.storydream.backend.domain.report.service.ReportService;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * AI 독서 리포트 API (보호자용)
 *
 * 화면1 : 아이 목록은 기존 GET /api/children 을 그대로 쓴다.
 * 화면2 : GET /api/reports/children/{childId}/summary
 *         GET /api/reports/children/{childId}/histories
 * 화면3 : GET /api/reports/reading-histories/{readingHistoryId}
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/reports")
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Report", description = "AI 독서 리포트 API")
public class ReportController {

    private final ReportService reportService;

    @Operation(
            summary = "전체 독서 요약 조회",
            description = """
                    기간 내 아동의 독서 요약을 조회합니다. (화면2 - 전체 요약 탭)

                    - from, to : 조회 기간 (생략하면 최근 30일)
                    - weeklyScores : from 기준 7일 단위 평균 정답률. 기록이 없는 주는 averageQuizScore가 null
                    - aiSummary : AI 종합 분석 (기간 내 독서 수가 그대로면 캐시된 문구를 재사용)
                    """
    )
    @GetMapping("/children/{childId}/summary")
    public ResponseEntity<ApiResponse<PeriodSummaryResponse>> getPeriodSummary(
            Authentication authentication,

            @Parameter(description = "아동 ID", example = "1")
            @PathVariable Integer childId,

            @Parameter(description = "조회 시작일", example = "2026-05-01")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = "조회 종료일", example = "2026-05-31")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        LocalDate end = (to != null) ? to : LocalDate.now();
        LocalDate start = (from != null) ? from : end.minusDays(29);

        return ResponseEntity.ok(
                ApiResponse.success(
                        reportService.getPeriodSummary(guardianId, childId, start, end)
                )
        );
    }

    @Operation(
            summary = "독서 이력 목록 조회",
            description = """
                    리포트가 생성된(= 완독한) 동화 목록을 최신순으로 조회합니다. (화면2·3 왼쪽 사이드바)
                    """
    )
    @GetMapping("/children/{childId}/histories")
    public ResponseEntity<ApiResponse<ReadingHistoryListResponse>> getReadingHistories(
            Authentication authentication,

            @Parameter(description = "아동 ID", example = "1")
            @PathVariable Integer childId,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        LocalDate end = (to != null) ? to : LocalDate.now();
        LocalDate start = (from != null) ? from : end.minusDays(29);

        return ResponseEntity.ok(
                ApiResponse.success(
                        reportService.getReadingHistories(guardianId, childId, start, end)
                )
        );
    }

    @Operation(
            summary = "동화별 AI 독서 리포트 조회",
            description = """
                    완독한 동화 1권에 대한 리포트를 조회합니다. (화면3)

                    - parts : 서론 → 본론 → 결론 순. quizScore로 '평균 정답률' 그래프,
                              level로 '난이도 변화' 그래프를 그리면 됩니다.
                    - 리포트는 독서 종료 후 비동기로 생성되므로, 아직 생성 전이면 202를 반환합니다.
                    """
    )
    @GetMapping("/reading-histories/{readingHistoryId}")
    public ResponseEntity<ApiResponse<StoryReportResponse>> getStoryReport(
            Authentication authentication,

            @Parameter(description = "독서 기록 ID", example = "15")
            @PathVariable Integer readingHistoryId
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        return ResponseEntity.ok(
                ApiResponse.success(
                        reportService.getStoryReport(guardianId, readingHistoryId)
                )
        );
    }
}