package com.storydream.backend.domain.report.client;

import com.storydream.backend.domain.report.service.ReportFacts;

import java.util.List;

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