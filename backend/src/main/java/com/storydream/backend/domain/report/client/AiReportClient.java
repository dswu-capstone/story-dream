package com.storydream.backend.domain.report.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
public class AiReportClient {

    private final RestClient restClient;

    public AiReportClient(RestClient aiServerRestClient) {
        this.restClient = aiServerRestClient;
    }

    /** 화면3: 개별 독서 리포트 코멘트 */
    public String generateSummary(AiSummaryRequest request) {
        return call("/ai/reading-report/summary", request);
    }

    /** 화면2: 기간 전체 AI 종합 분석 */
    public String generatePeriodSummary(AiPeriodSummaryRequest request) {
        return call("/ai/reading-report/period-summary", request);
    }

    private String call(String uri, Object body) {
        AiSummaryResponse response = restClient.post()
                .uri(uri)
                .body(body)
                .retrieve()
                .body(AiSummaryResponse.class);

        if (response == null || response.summary() == null || response.summary().isBlank()) {
            throw new IllegalStateException("AI 서버가 빈 요약을 반환했습니다. uri=" + uri);
        }
        return response.summary();
    }
}
