package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.focus.repository.FocusLogRepository;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingStatus;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.report.client.AiSummaryRequest;
import com.storydream.backend.domain.report.dto.ReportMetrics;
import com.storydream.backend.domain.report.entity.AiReadingReport;
import com.storydream.backend.domain.report.repository.AiReadingReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AiReadingReportGenerator {

    private final ReadingHistoryRepository readingHistoryRepository;
    private final ReadingLogRepository readingLogRepository;
    private final QuizResultRepository quizResultRepository;
    private final FocusLogRepository focusLogRepository;
    private final AiReadingReportRepository reportRepository;
    private final ReportMetricsCalculator calculator;

//    @Transactional
//    public Integer createDraft(Integer readingHistoryId) {
//        ReadingHistory history = readingHistoryRepository.findById(readingHistoryId)
//                .orElseThrow(() -> new IllegalArgumentException("독서 이력이 없습니다. id=" + readingHistoryId));
//
//        if (history.getStatus() != ReadingStatus.COMPLETED) {
//            throw new IllegalStateException("완료된 독서만 리포트를 생성할 수 있습니다.");
//        }
//        if (history.getEndedAt() == null) {
//            throw new IllegalStateException("종료 시각이 없는 독서는 리포트를 생성할 수 없습니다.");
//        }
//
//        ReportMetrics metrics = calculator.calculate(
//                history.getStartedAt(),
//                history.getEndedAt(),
//                readingLogRepository.findAllByReadingHistoryIdOrderByCreatedAtAsc(readingHistoryId),
//                quizResultRepository.findPartStatsByReadingHistoryId(readingHistoryId),
//                focusLogRepository.findPartStatsByReadingHistoryId(readingHistoryId)
//        );
//
//
//        AiReadingReport report = reportRepository.findByReadingHistoryId(readingHistoryId)
//                .orElseGet(() -> AiReadingReport.of(history, history.getChild(), metrics));
//
//        report.applyMetrics(metrics);
//        report.replaceParts(metrics.parts());
//        report.markProcessing();
//
//        return reportRepository.save(report).getId();
//    }
        @Transactional
        public Integer createDraft(Integer readingHistoryId) {
            ReadingHistory history = readingHistoryRepository.findById(readingHistoryId)
                    .orElseThrow(() -> new IllegalArgumentException("독서 이력이 없습니다. id=" + readingHistoryId));

            if (history.getStatus() != ReadingStatus.COMPLETED) {
                throw new IllegalStateException("완료된 독서만 리포트를 생성할 수 있습니다.");
            }
            if (history.getEndedAt() == null) {
                throw new IllegalStateException("종료 시각이 없는 독서는 리포트를 생성할 수 없습니다.");
            }

            ReportMetrics metrics = calculator.calculate(
                    history.getStartedAt(),
                    history.getEndedAt(),
                    readingLogRepository.findAllByReadingHistoryIdOrderByCreatedAtAsc(readingHistoryId),
                    quizResultRepository.findPartStatsByReadingHistoryId(readingHistoryId),
                    focusLogRepository.findPartStatsByReadingHistoryId(readingHistoryId)
            );

            AiReadingReport report = reportRepository.findByReadingHistoryId(readingHistoryId)
                    .orElseGet(() -> reportRepository.save(
                            AiReadingReport.of(history, history.getChild(), metrics)));

            report.applyMetrics(metrics);

            report.getParts().clear();
            reportRepository.flush();

            report.replaceParts(metrics.parts());
            report.markProcessing();

            return reportRepository.save(report).getId();
        }


    @Transactional(readOnly = true)
    public AiSummaryRequest buildRequest(Integer reportId) {
        AiReadingReport report = reportRepository.findWithDetailById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("리포트가 없습니다. id=" + reportId));

        List<AiSummaryRequest.PartPayload> parts = report.getParts().stream()
                .map(p -> new AiSummaryRequest.PartPayload(
                        p.getPartType().getDbValue(),
                        p.getLevel(),
                        p.getAccuracy().doubleValue(),
                        p.getDistractionCount()))
                .toList();

        return new AiSummaryRequest(
                report.getChild().getName(),
                Period.between(report.getChild().getBirthDate(), LocalDate.now()).getYears() * 12,
                report.getReadingHistory().getOriginalStory().getTitle(),
                report.getTotalReadingSec(),
                report.getAverageQuizScore().doubleValue(),
                report.getDistractionCount(),
                report.getStartLevel(),
                report.getEndLevel(),
                parts
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeReport(Integer reportId, String summary) {
        reportRepository.findById(reportId).ifPresent(r -> r.completeWithSummary(summary));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failReport(Integer reportId, String reason) {
        reportRepository.findById(reportId).ifPresent(r -> r.fail(reason));
    }
}
