package com.storydream.backend.global.client;

import com.storydream.backend.domain.story.dto.AiRecommendationRequest;
import com.storydream.backend.domain.story.dto.AiRecommendationResponse;
import com.storydream.backend.domain.story.dto.AiRecommendedStory;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

@Component
@RequiredArgsConstructor
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
            String languageCode
    ) {

        AiRecommendationRequest request =
                new AiRecommendationRequest(
                        interests,
                        languageCode
                );

        AiRecommendationResponse response =
                aiRestClient.post()
                        .uri("/recommendations")
                        .body(request)
                        .retrieve()
                        .body(AiRecommendationResponse.class);

        if (response == null) {
            throw new BusinessException(ErrorCode.AI_RECOMMENDATION_FAILED);
        }
        return response.recommendations();
    }
}