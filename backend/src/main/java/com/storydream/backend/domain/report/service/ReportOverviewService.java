package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.report.client.AiPeriodSummaryRequest;
import com.storydream.backend.domain.report.client.AiReportClient;
import com.storydream.backend.domain.report.dto.ReportOverviewResponse;
import com.storydream.backend.domain.report.dto.ReportOverviewResponse.WeeklyScorePoint;
import com.storydream.backend.domain.report.entity.ChildPeriodSummary;
import com.storydream.backend.domain.report.exception.InvalidPeriodException;
import com.storydream.backend.domain.report.repository.AiReadingReportRepository;
import com.storydream.backend.domain.report.repository.ChildPeriodSummaryRepository;
import com.storydream.backend.domain.report.repository.projection.PeriodAggregate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportOverviewService {

    private static final int MAX_PERIOD_DAYS = 366;

    private final AiReadingReportRepository reportRepository;
    private final ChildPeriodSummaryRepository summaryRepository;
    private final ChildRepository childRepository;
    private final WeeklyBucketAssembler bucketAssembler;
    private final AiReportClient aiReportClient;

    @Transactional
    public ReportOverviewResponse getOverview(Integer guardianId, Integer childId,
                                              LocalDate from, LocalDate to) {

        validatePeriod(from, to);

        Child child = childRepository.findById(childId)
                .orElseThrow(() -> new IllegalArgumentException("아이 정보가 없습니다. id=" + childId));
        if (!child.getGuardian().getId().equals(guardianId)) {
            throw new SecurityException("해당 아이의 리포트에 접근할 수 없습니다.");
        }

        List<WeeklyScorePoint> weeklyScores = bucketAssembler.assemble(
                from, to, reportRepository.findWeeklyScores(childId, from, to));

        PeriodAggregate agg = reportRepository.findPeriodAggregate(
                childId, from.atStartOfDay(), to.plusDays(1).atStartOfDay());

        long reportCount = agg.getReportCount() == null ? 0 : agg.getReportCount();
        BigDecimal avgScore = round1(agg.getAvgScore());
        BigDecimal avgFocus = round1(agg.getAvgFocusRate());

        ChildPeriodSummary summary = summaryRepository
                .findByChildIdAndPeriodStartAndPeriodEnd(childId, from, to)
                .orElseGet(() -> summaryRepository.save(ChildPeriodSummary.of(child, from, to)));

        summary.updateStats((int) reportCount, avgScore, avgFocus);

        if (reportCount == 0) {
            summary.completeWithSummary("아직 이 기간에 완료한 독서가 없어요.", 0);
        } else if (summary.isStale(reportCount)) {
            try {
                String text = aiReportClient.generatePeriodSummary(
                        new AiPeriodSummaryRequest(
                                child.getName(), from, to, (int) reportCount,
                                avgScore == null ? null : avgScore.doubleValue(),
                                avgFocus == null ? null : avgFocus.doubleValue(),
                                weeklyScores.stream()
                                        .map(w -> new AiPeriodSummaryRequest.WeeklyPayload(
                                                w.label(), w.readingCount(), w.averageQuizScore()))
                                        .toList()));
                summary.completeWithSummary(text, (int) reportCount);
            } catch (Exception e) {
                log.error("기간 요약 생성 실패. childId={}, {}~{}", childId, from, to, e);
                summary.fail();
            }
        }

        return new ReportOverviewResponse(
                childId,
                child.getName(),
                from,
                to,
                (int) reportCount,
                avgScore == null ? null : avgScore.doubleValue(),
                avgFocus == null ? null : avgFocus.doubleValue(),
                weeklyScores,
                summary.getAiSummary(),
                summary.getStatus().name()
        );
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new InvalidPeriodException("조회 기간을 지정해주세요.");
        }
        if (from.isAfter(to)) {
            throw new InvalidPeriodException("시작일이 종료일보다 늦을 수 없습니다.");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_PERIOD_DAYS) {
            throw new InvalidPeriodException("조회 기간은 최대 1년까지 가능합니다.");
        }
    }

    private BigDecimal round1(BigDecimal value) {
        return value == null ? null : value.setScale(1, java.math.RoundingMode.HALF_UP);
    }
}
