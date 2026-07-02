package com.storydream.backend.domain.story.controller;

import com.storydream.backend.domain.story.dto.StoryRecommendationResponse;
import com.storydream.backend.domain.story.service.StoryServiceImpl;
import com.storydream.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor // final 필드를 채우는 생성자 자동 생성
@RequestMapping("/api/stories")

public class StoryController {

    final StoryServiceImpl storyService;

    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<StoryRecommendationResponse>> getRecommendations(
            @RequestParam Integer childId,
            @RequestParam String languageCode,
            @RequestParam Integer page,
            @RequestParam Integer size
    ) {
        return ResponseEntity.ok( // 상태 코드를 포함하는 응답 객체 생성
                ApiResponse.success( // success, data, message 형태로 감싸는 객체
                        storyService.getRecommendations(childId, languageCode, page, size) // service 호출 -> StoryRecommendationResponse 반환
                )
        );

    }

}
