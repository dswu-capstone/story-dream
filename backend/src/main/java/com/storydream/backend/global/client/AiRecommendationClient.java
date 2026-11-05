package com.storydream.backend.global.client;

import com.storydream.backend.domain.story.dto.AiRecommendationRequest;
import com.storydream.backend.domain.story.dto.AiRecommendationResponse;
import com.storydream.backend.domain.story.dto.AiRecommendedStory;
import com.storydream.backend.domain.story.dto.AiReadingBehavior;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class AiRecommendationClient {

    private final RestClient aiRestClient;

    // 캐시 확인
    // key가 존재 -> 저장된 캐시 반환
    // key 존재 x -> ai 호출 후 캐시에 저장한 후 반환
    @Cacheable(
            value = "storyRecommendations", // 캐시 이름
            key = "#childId + ':' + #languageCode"
    )
    public List<AiRecommendedStory> getRecommendations(
            Integer childId,
            String[] interests,
            String languageCode,
            List<AiReadingBehavior> readingBehaviors
    ) {

        AiRecommendationRequest request =
                new AiRecommendationRequest(
                        interests,
                        languageCode,
                        readingBehaviors
                );
//
//        System.out.println("===== AI 추천 요청 =====");
//        System.out.println("childId = " + childId);
//        System.out.println("interests = " + java.util.Arrays.toString(interests));
//        System.out.println("languageCode = " + languageCode);
//        System.out.println("======================");


        long startedAt = System.nanoTime();
        AiRecommendationResponse response = null;
        try {
            response = aiRestClient.post()
                    .uri("/recommendations")
                    .body(request)
                    .retrieve()
                    .body(AiRecommendationResponse.class);
            return requireRecommendations(response);
        } finally {
            log.info(
                    "recommendation_ai_http_timing childId={} languageCode={} durationMs={} success={}",
                    childId,
                    languageCode,
                    elapsedMillis(startedAt),
                    response != null
            );
        }
    }

    private List<AiRecommendedStory> requireRecommendations(AiRecommendationResponse response) {
        if (response == null) {
            throw new BusinessException(ErrorCode.AI_RECOMMENDATION_FAILED);
        }
        return response.recommendations();
//
//        String response =
//                aiRestClient.post()
//                        .uri("/debug")
//                        .contentType(MediaType.APPLICATION_JSON)
//                        .body(request)
//                        .retrieve()
//                        .body(String.class);
//
//        System.out.println("FastAPI response = " + response);
//
//        return List.of(); // 디버깅용 임시
    }

    private long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
