package com.storydream.backend.domain.story.controller;

import com.storydream.backend.domain.story.dto.StoryRecommendationResponse;
import com.storydream.backend.domain.story.service.StoryServiceImpl;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequiredArgsConstructor // final 필드를 채우는 생성자 자동 생성
@RequestMapping("/api/stories")
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Story", description = "동화 관련 API")
public class StoryController {

    final StoryServiceImpl storyService;
    @Operation(
            summary = "추천 동화 목록 조회",
            description = """
                    아이의 언어(languageCode)에 맞는 추천 동화 목록을 페이지 단위로 조회합니다.
                    
                    - childId : 추천 동화를 조회할 아동 ID
                    - languageCode : 조회할 동화 언어(ko, en)
                    - page : 조회할 페이지 번호(0부터 시작)
                    - size : 한 페이지에 보여줄 동화 개수
                    """
    )
    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<StoryRecommendationResponse>> getRecommendations(
            @Parameter(description = "추천 동화를 조회할 아동 ID", example = "1")
            @RequestParam Integer childId,

            @Parameter(description = "조회할 동화 언어 (ko, en)", example = "ko")
            @RequestParam String languageCode,

            @Parameter(description = "조회할 페이지 번호 (0부터 시작)", example = "0")
            @RequestParam Integer page,

            @Parameter(description = "한 페이지에 보여줄 동화 개수", example = "4")
            @RequestParam Integer size
    ) {
        return ResponseEntity.ok( // 상태 코드를 포함하는 응답 객체 생성
                ApiResponse.success( // success, data, message 형태로 감싸는 객체
                        storyService.getRecommendations(childId, languageCode, page, size) // service 호출 -> StoryRecommendationResponse 반환
                )
        );

    }

}
