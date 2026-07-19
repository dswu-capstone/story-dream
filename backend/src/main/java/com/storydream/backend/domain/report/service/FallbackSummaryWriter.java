package com.storydream.backend.domain.report.service;

import org.springframework.stereotype.Component;

@Component
public class FallbackSummaryWriter {

    public String forStory(ReportFacts facts) {
        int minutes = Math.max(1, facts.readingSeconds() / 60);

        return "%s이(가) '%s'를 끝까지 읽었어요. 평균 정답률은 %.0f%%이고, 읽는 데 약 %d분이 걸렸어요.%s"
                .formatted(
                        facts.childName(),
                        facts.storyTitle(),
                        facts.averageQuizScore().doubleValue(),
                        minutes,
                        levelTrend(facts)
                );
    }

    public String forPeriod(String childName, PeriodFacts facts) {
        if (facts.readingCount() == 0) {
            return "이 기간에는 완료한 독서 기록이 없어요.";
        }

        return "%s은(는) 이 기간 동안 동화 %d권을 읽었고, 평균 정답률은 %.0f%%예요."
                .formatted(
                        childName,
                        facts.readingCount(),
                        facts.averageQuizScore().doubleValue()
                );
    }

    private String levelTrend(ReportFacts facts) {
        if (facts.startLevel() == null || facts.endLevel() == null) {
            return "";
        }
        if (facts.endLevel() > facts.startLevel()) {
            return " 뒤로 갈수록 난이도가 올라갔어요.";
        }
        if (facts.endLevel() < facts.startLevel()) {
            return " 중간에 난이도를 조금 낮춰 읽었어요.";
        }
        return " 난이도는 처음부터 끝까지 유지되었어요.";
    }
}