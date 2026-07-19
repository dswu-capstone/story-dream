package com.storydream.backend.domain.report.client;

import com.storydream.backend.domain.report.service.ReportFacts;

import java.util.List;

/** AI 서버(FastAPI)로 보내는 "동화 1권 리포트" 요약 요청. 문장이 아니라 '집계된 사실'만 보낸다. */
public record AiStorySummaryRequest(
        String childName,
        Integer childAge,
        String storyTitle,
        Integer readingSeconds,
        Double averageQuizScore,
        Integer focusLossCount,
        List<Part> parts
) {

    public record Part(
            String partType,
            Integer level,
            Double quizScore,
            Integer quizCorrectCount,
            Integer quizTotalCount,
            Integer focusLossCount
    ) {
    }

    public static AiStorySummaryRequest from(ReportFacts facts) {
        List<Part> parts = facts.parts().stream()
                .map(part -> new Part(
                        part.partType().getLabel(),
                        part.level(),
                        part.quizScore().doubleValue(),
                        part.quizCorrectCount(),
                        part.quizTotalCount(),
                        part.focusLossCount()
                ))
                .toList();

        return new AiStorySummaryRequest(
                facts.childName(),
                facts.childAge(),
                facts.storyTitle(),
                facts.readingSeconds(),
                facts.averageQuizScore().doubleValue(),
                facts.focusLossCount(),
                parts
        );
    }
}