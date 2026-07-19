package com.storydream.backend.domain.report.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * FastAPI AI 서버 호출
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportAiClient {

    private final RestClient aiRestClient;

    public String summarizeStory(AiStorySummaryRequest request) {
        return call("/api/ai/reports/story", request);
    }

    public String summarizePeriod(AiPeriodSummaryRequest request) {
        return call("/api/ai/reports/period", request);
    }

    private String call(String path, Object body) {
        try {
            AiSummaryResponse response = aiRestClient.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(AiSummaryResponse.class);

            return response == null ? null : response.summary();

        } catch (Exception e) {
            log.warn("[AI 리포트] 요약 생성 실패. path={}, cause={}", path, e.toString());
            return null;
        }
    }
}