//package com.storydream.backend.domain.report.controller;
//
//import com.storydream.backend.domain.report.dto.ReportDetailResponse;
//import com.storydream.backend.domain.report.dto.ReportOverviewResponse;
//import com.storydream.backend.domain.report.dto.ReportSummaryResponse;
//import com.storydream.backend.domain.report.service.AiReadingReportQueryService;
//import com.storydream.backend.domain.report.service.ReportGenerationFacade;
//import com.storydream.backend.domain.report.service.ReportOverviewService;
//import lombok.RequiredArgsConstructor;
//import org.springframework.data.domain.Page;
//import org.springframework.data.domain.Pageable;
//import org.springframework.data.web.PageableDefault;
//import org.springframework.format.annotation.DateTimeFormat;
//import org.springframework.http.ResponseEntity;
//import org.springframework.web.bind.annotation.*;
//
//import java.time.LocalDate;
//
//@RestController
//@RequestMapping("/api/v1")
//@RequiredArgsConstructor
//public class AiReadingReportController {
//
//    private final AiReadingReportQueryService queryService;
//    private final ReportOverviewService overviewService;
//    private final ReportGenerationFacade generationFacade;
//
//    @GetMapping("/children/{childId}/reading-reports/overview")
//    public ResponseEntity<ReportOverviewResponse> getOverview(
//            @RequestHeader("X-Guardian-Id") Integer guardianId,
//            @PathVariable Integer childId,
//            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
//            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
//
//        return ResponseEntity.ok(
//                overviewService.getOverview(guardianId, childId, from, to));
//    }
//
//    @GetMapping("/children/{childId}/reading-reports")
//    public ResponseEntity<Page<ReportSummaryResponse>> getReports(
//            @RequestHeader("X-Guardian-Id") Integer guardianId,
//            @PathVariable Integer childId,
//            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
//            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
//            @PageableDefault(size = 20) Pageable pageable) {
//
//        return ResponseEntity.ok(
//                queryService.getReports(guardianId, childId, from, to, pageable));
//    }
//
//    @GetMapping("/reading-reports/{reportId}")
//    public ResponseEntity<ReportDetailResponse> getReportDetail(
//            @RequestHeader("X-Guardian-Id") Integer guardianId,
//            @PathVariable Integer reportId) {
//
//        return ResponseEntity.ok(
//                queryService.getReportDetail(guardianId, reportId));
//    }
//
//    @PostMapping("/reading-histories/{historyId}/reading-report")
//    public ResponseEntity<Integer> regenerate(@PathVariable Integer historyId) {
//        return ResponseEntity.ok(generationFacade.generate(historyId));
//    }
//}


package com.storydream.backend.domain.report.controller;

import com.storydream.backend.domain.report.dto.ReportDetailResponse;
import com.storydream.backend.domain.report.dto.ReportOverviewResponse;
import com.storydream.backend.domain.report.dto.ReportSummaryResponse;
import com.storydream.backend.domain.report.service.AiReadingReportQueryService;
import com.storydream.backend.domain.report.service.ReportGenerationFacade;
import com.storydream.backend.domain.report.service.ReportOverviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@Tag(name = "AI Reading Report", description = "AI 독서 리포트 관련 API")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AiReadingReportController {

    private final AiReadingReportQueryService queryService;
    private final ReportOverviewService overviewService;
    private final ReportGenerationFacade generationFacade;

    @Operation(
            summary = "전체 독서 요약 조회",
            description = """
                    선택한 아이의 지정 기간 독서 활동을 종합해서 반환합니다.

                    - `childId` : 조회할 아이 ID
                    - `from` / `to` : 조회 기간 (완료 날짜 기준, `yyyy-MM-dd`)
                    - `weeklyScores` : 기간 시작일부터 7일씩 끊은 주차별 평균 정답률 (독서가 없는 주는 `averageQuizScore`가 `null`)
                    - `aiSummary` : FastAPI가 생성한 AI 종합 분석 문구

                    AI 종합 분석은 `child_period_summary`에 캐시됩니다. \
                    같은 기간을 처음 조회할 때만 AI 서버를 호출하므로 첫 응답은 수 초가 걸릴 수 있고, \
                    이후 조회는 즉시 반환됩니다.
                    """
    )
    @GetMapping("/children/{childId}/reading-reports/overview")
    public ResponseEntity<ReportOverviewResponse> getOverview(
            @Parameter(description = "로그인한 보호자 ID", example = "1")
            @RequestHeader("X-Guardian-Id") Integer guardianId,

            @Parameter(description = "조회할 아이 ID", example = "1")
            @PathVariable Integer childId,

            @Parameter(description = "조회 시작일 (yyyy-MM-dd)", example = "2026-05-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = "조회 종료일 (yyyy-MM-dd)", example = "2026-05-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        return ResponseEntity.ok(
                overviewService.getOverview(guardianId, childId, from, to));
    }

    @Operation(
            summary = "독서 이력 목록 조회",
            description = """
                    선택한 아이가 지정 기간에 완료한 독서 목록을 최신순으로 반환합니다.

                    - `childId` : 조회할 아이 ID
                    - `from` / `to` : 조회 기간 (완료 날짜 기준, `yyyy-MM-dd`)
                    - `completedDate` : 독서를 끝낸 날짜 (`reading_history.ended_at` 기준)

                    같은 동화를 여러 번 읽을 수 있으므로 목록에 동일한 제목이 반복될 수 있습니다. \
                    항목 구분은 `completedDate`로 합니다. 리포트 생성이 완료된(`COMPLETED`) 건만 조회됩니다.
                    """
    )
    @GetMapping("/children/{childId}/reading-reports")
    public ResponseEntity<Page<ReportSummaryResponse>> getReports(
            @Parameter(description = "로그인한 보호자 ID", example = "1")
            @RequestHeader("X-Guardian-Id") Integer guardianId,

            @Parameter(description = "조회할 아이 ID", example = "1")
            @PathVariable Integer childId,

            @Parameter(description = "조회 시작일 (yyyy-MM-dd)", example = "2026-05-01")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = "조회 종료일 (yyyy-MM-dd)", example = "2026-05-31")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @PageableDefault(size = 20) Pageable pageable) {

        return ResponseEntity.ok(
                queryService.getReports(guardianId, childId, from, to, pageable));
    }

    @Operation(
            summary = "독서 리포트 상세 조회",
            description = """
                    목록에서 선택한 독서 1건의 리포트를 반환합니다.

                    - `reportId` : 조회할 리포트 ID
                    - `parts` : 서론/본론/결론 구간별 데이터 (`accuracy`는 정답률 그래프, `level`은 난이도 변화 그래프의 Y축)
                    - `aiSummary` : FastAPI가 생성한 코멘트

                    `parts`는 리포트 생성 시점에 확정된 스냅샷이므로 원본 데이터가 바뀌어도 과거 리포트는 변하지 않습니다. \
                    퀴즈를 하나도 풀지 않은 경우 `averageQuizScore`가 `0.0`으로 내려가므로, \
                    화면에서는 `totalQuizCount`가 `0`인지 함께 확인해야 합니다.
                    """
    )
    @GetMapping("/reading-reports/{reportId}")
    public ResponseEntity<ReportDetailResponse> getReportDetail(
            @Parameter(description = "로그인한 보호자 ID", example = "1")
            @RequestHeader("X-Guardian-Id") Integer guardianId,

            @Parameter(description = "조회할 리포트 ID", example = "1")
            @PathVariable Integer reportId) {

        return ResponseEntity.ok(
                queryService.getReportDetail(guardianId, reportId));
    }

    @Operation(
            summary = "독서 리포트 생성 / 재생성",
            description = """
                    완료된 독서 1건에 대해 AI 리포트를 생성합니다.

                    - `historyId` : 리포트를 만들 독서 기록 ID

                    `reading_log`, `quiz_result`, `focus_log`를 집계해 지표를 계산하고, \
                    FastAPI(AI 서버)를 호출해 요약 문구를 생성한 뒤 `ai_reading_report`에 저장합니다. \
                    생성된 리포트 ID를 반환합니다.

                    독서 종료 시 자동으로 호출되므로 평소에는 사용할 필요가 없습니다. \
                    AI 서버 오류로 리포트 상태가 `FAILED`가 된 경우 재시도 용도로 사용합니다. \
                    이미 리포트가 있으면 새로 만들지 않고 기존 리포트를 갱신합니다.
                    """
    )
    @PostMapping("/reading-histories/{historyId}/reading-report")
    public ResponseEntity<Integer> regenerate(
            @Parameter(description = "리포트를 생성할 독서 기록 ID", example = "1")
            @PathVariable Integer historyId) {

        return ResponseEntity.ok(generationFacade.generate(historyId));
    }
}