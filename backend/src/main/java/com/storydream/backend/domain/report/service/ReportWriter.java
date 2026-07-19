package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.report.entity.AiReadingReport;
import com.storydream.backend.domain.report.entity.AiReadingReportPart;
import com.storydream.backend.domain.report.entity.ChildPeriodReport;
import com.storydream.backend.domain.report.repository.AiReadingReportRepository;
import com.storydream.backend.domain.report.repository.ChildPeriodReportRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class ReportWriter {

    private final AiReadingReportRepository reportRepository;
    private final ChildPeriodReportRepository periodReportRepository;
    private final ReadingHistoryRepository readingHistoryRepository;
    private final ChildRepository childRepository;

    @Transactional
    public void saveStoryReport(ReportFacts facts, String aiSummary, boolean aiGenerated) {

        if (reportRepository.existsByReadingHistoryId(facts.readingHistoryId())) {
            return;
        }

        ReadingHistory history = readingHistoryRepository.getReferenceById(facts.readingHistoryId());

        AiReadingReport report = AiReadingReport.builder()
                .readingHistory(history)
                .averageQuizScore(facts.averageQuizScore())
                .totalQuizCount(facts.totalQuizCount())
                .correctQuizCount(facts.correctQuizCount())
                .readingSeconds(facts.readingSeconds())
                .startLevel(facts.startLevel())
                .endLevel(facts.endLevel())
                .focusLossCount(facts.focusLossCount())
                .awaySeconds(null)
                .aiSummary(aiSummary)
                .aiGenerated(aiGenerated)
                .build();

        for (PartFact part : facts.parts()) {
            report.addPart(AiReadingReportPart.builder()
                    .partType(part.partType())
                    .level(part.level())
                    .quizTotalCount(part.quizTotalCount())
                    .quizCorrectCount(part.quizCorrectCount())
                    .quizScore(part.quizScore())
                    .focusLossCount(part.focusLossCount())
                    .build());
        }

        reportRepository.save(report);
    }

    @Transactional
    public void upsertPeriodReport(
            Integer childId,
            LocalDate periodStart,
            LocalDate periodEnd,
            int readingCount,
            BigDecimal averageQuizScore,
            int totalReadingSeconds,
            String aiSummary,
            boolean aiGenerated
    ) {
        periodReportRepository
                .findByChildIdAndPeriodStartAndPeriodEnd(childId, periodStart, periodEnd)
                .ifPresentOrElse(
                        report -> report.refresh(
                                readingCount,
                                averageQuizScore,
                                totalReadingSeconds,
                                aiSummary,
                                aiGenerated
                        ),
                        () -> {
                            Child child = childRepository.findById(childId)
                                    .orElseThrow(() -> new BusinessException(ErrorCode.CHILD_NOT_FOUND));

                            periodReportRepository.save(ChildPeriodReport.builder()
                                    .child(child)
                                    .periodStart(periodStart)
                                    .periodEnd(periodEnd)
                                    .readingCount(readingCount)
                                    .averageQuizScore(averageQuizScore)
                                    .totalReadingSeconds(totalReadingSeconds)
                                    .aiSummary(aiSummary)
                                    .aiGenerated(aiGenerated)
                                    .build());
                        }
                );
    }
}