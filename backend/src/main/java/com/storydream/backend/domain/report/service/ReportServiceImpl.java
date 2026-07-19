package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.report.client.AiPeriodSummaryRequest;
import com.storydream.backend.domain.report.client.AiStorySummaryRequest;
import com.storydream.backend.domain.report.client.ReportAiClient;
import com.storydream.backend.domain.report.dto.*;
import com.storydream.backend.domain.report.entity.AiReadingReport;
import com.storydream.backend.domain.report.entity.AiReadingReportPart;
import com.storydream.backend.domain.report.entity.ChildPeriodReport;
import com.storydream.backend.domain.report.repository.AiReadingReportRepository;
import com.storydream.backend.domain.report.repository.ChildPeriodReportRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    private static final DateTimeFormatter LABEL_FORMAT = DateTimeFormatter.ofPattern("M/d");

    private final ReportDataCollector collector;
    private final ReportWriter writer;
    private final ReportAiClient aiClient;
    private final FallbackSummaryWriter fallbackSummaryWriter;

    private final AiReadingReportRepository reportRepository;
    private final ChildPeriodReportRepository periodReportRepository;
    private final ChildRepository childRepository;

    // =================================================================
    // 리포트 생성 (독서 완료 시 1회)
    //   집계(읽기 TX) → AI 호출(TX 밖) → 저장(쓰기 TX)
    //   이 메서드에는 @Transactional을 붙이지 않는다. GPT 응답을 기다리는 동안
    //   DB 커넥션을 잡고 있지 않기 위해서다.
    // =================================================================
    @Override
    public void generateStoryReport(Integer readingHistoryId) {

        if (reportRepository.existsByReadingHistoryId(readingHistoryId)) {
            return; // 멱등 : 이미 만들어진 리포트는 다시 만들지 않는다
        }

        ReportFacts facts = collector.collectStory(readingHistoryId);

        String summary = aiClient.summarizeStory(AiStorySummaryRequest.from(facts));
        boolean aiGenerated = StringUtils.hasText(summary);
        if (!aiGenerated) {
            summary = fallbackSummaryWriter.forStory(facts);
        }

        writer.saveStoryReport(facts, summary, aiGenerated);
    }

    // =================================================================
    // 화면3 : 동화 1권 리포트
    // =================================================================
    @Override
    @Transactional(readOnly = true)
    public StoryReportResponse getStoryReport(Integer guardianId, Integer readingHistoryId) {

        AiReadingReport report = reportRepository.findDetailByReadingHistoryId(readingHistoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REPORT_NOT_READY));

        ReadingHistory history = report.getReadingHistory();
        Child child = history.getChild();

        if (!child.getGuardian().getId().equals(guardianId)) {
            throw new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND);
        }

        List<ReportPartResponse> parts = report.getParts().stream()
                .sorted(Comparator.comparing(AiReadingReportPart::getOrderNum))
                .map(part -> new ReportPartResponse(
                        part.getPartType().getLabel(),
                        part.getOrderNum(),
                        part.getLevel(),
                        part.getQuizScore(),
                        part.getQuizCorrectCount(),
                        part.getQuizTotalCount(),
                        part.getFocusLossCount()
                ))
                .toList();

        return new StoryReportResponse(
                history.getId(),
                child.getId(),
                child.getName(),
                history.getOriginalStory().getId(),
                history.getOriginalStory().getTitle(),
                history.getEndedAt() == null ? null : history.getEndedAt().toLocalDate(),
                report.getReadingSeconds(),
                report.getAverageQuizScore(),
                report.getStartLevel(),
                report.getEndLevel(),
                report.getFocusLossCount(),
                parts,
                report.getAiSummary()
        );
    }

    // =================================================================
    // 사이드바 : 독서 이력 목록
    // =================================================================
    @Override
    @Transactional(readOnly = true)
    public ReadingHistoryListResponse getReadingHistories(
            Integer guardianId,
            Integer childId,
            LocalDate from,
            LocalDate to
    ) {
        findChild(guardianId, childId);
        validatePeriod(from, to);

        PeriodFacts facts = collector.collectPeriod(childId, from, to);

        return new ReadingHistoryListResponse(facts.histories());
    }

    // =================================================================
    // 화면2 : 전체 독서 요약
    //   주차별 꺾은선은 매번 집계(가볍다).
    //   AI 종합 분석만 (아이 + 기간) 단위로 캐시한다(비싸다).
    // =================================================================
    @Override
    public PeriodSummaryResponse getPeriodSummary(
            Integer guardianId,
            Integer childId,
            LocalDate from,
            LocalDate to
    ) {
        Child child = findChild(guardianId, childId);
        validatePeriod(from, to);

        PeriodFacts facts = collector.collectPeriod(childId, from, to);
        String summary = resolvePeriodSummary(child, from, to, facts);

        List<WeeklyScoreResponse> weeklyScores = facts.weeklyScores().stream()
                .map(week -> new WeeklyScoreResponse(
                        week.weekIndex(),
                        week.weekStart(),
                        week.weekEnd(),
                        week.weekStart().format(LABEL_FORMAT) + " ~ " + week.weekEnd().format(LABEL_FORMAT),
                        week.averageQuizScore(),
                        week.readingCount()
                ))
                .toList();

        return new PeriodSummaryResponse(
                child.getId(),
                child.getName(),
                from,
                to,
                facts.readingCount(),
                facts.averageQuizScore(),
                facts.totalReadingSeconds(),
                weeklyScores,
                summary
        );
    }

    /** 기간 내 완독 수가 그대로면 GPT를 다시 부르지 않는다. */
    private String resolvePeriodSummary(
            Child child,
            LocalDate from,
            LocalDate to,
            PeriodFacts facts
    ) {
        Optional<ChildPeriodReport> cached = periodReportRepository
                .findByChildIdAndPeriodStartAndPeriodEnd(child.getId(), from, to);

        if (cached.isPresent() && cached.get().isFresh(facts.readingCount())) {
            return cached.get().getAiSummary();
        }

        String summary = null;
        if (facts.readingCount() > 0) {
            summary = aiClient.summarizePeriod(
                    AiPeriodSummaryRequest.of(
                            child.getName(),
                            ageOf(child),
                            from,
                            to,
                            facts
                    )
            );
        }

        boolean aiGenerated = StringUtils.hasText(summary);
        if (!aiGenerated) {
            summary = fallbackSummaryWriter.forPeriod(child.getName(), facts);
        }

        writer.upsertPeriodReport(
                child.getId(),
                from,
                to,
                facts.readingCount(),
                facts.averageQuizScore(),
                facts.totalReadingSeconds(),
                summary,
                aiGenerated
        );

        return summary;
    }

    private Child findChild(Integer guardianId, Integer childId) {
        return childRepository.findByIdAndGuardianId(childId, guardianId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHILD_NOT_FOUND));
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new BusinessException(ErrorCode.INVALID_PERIOD);
        }
    }

    private Integer ageOf(Child child) {
        if (child.getBirthDate() == null) {
            return null;
        }
        return Period.between(child.getBirthDate(), LocalDate.now()).getYears();
    }
}