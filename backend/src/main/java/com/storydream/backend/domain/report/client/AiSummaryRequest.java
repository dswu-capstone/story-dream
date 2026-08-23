package com.storydream.backend.domain.report.client;

import java.util.List;

public record AiSummaryRequest(
        String childName,
        int childAgeMonths,
        String storyTitle,
        int totalReadingSec,
        double averageQuizScore,
        int distractionCount,
        Integer startLevel,
        Integer endLevel,
        List<PartPayload> parts
) {
    public record PartPayload(
            String partType,
            int level,
            double accuracy,
            int distractionCount
    ) {}
}