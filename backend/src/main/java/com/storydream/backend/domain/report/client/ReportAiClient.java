package com.storydream.backend.domain.report.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * FastAPI AI 서버 호출.
 * 프롬프트와 모델 선택은 AI 서버가 담당하고, 여기서는 집계된 사실만 넘긴다.
 *
 * AI 호출은 언제든 실패할 수 있으므로 예외를 위로 던지지 않는다.
 * 실패하면 null을 반환하고, 서비스가 규칙 기반 문구로 대체한다(리포트 화면이 죽지 않도록).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportAiClient {

    private final RestClient aiRestClient;

    /** 실패 시 null */
    public String summarizeStory(AiStorySummaryRequest request) {
        return call("/api/ai/reports/story", request);
    }

    /** 실패 시 null */
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