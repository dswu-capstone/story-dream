package com.storydream.backend.domain.story.controller;

import com.storydream.backend.domain.story.dto.StoryDetailResponse;
import com.storydream.backend.domain.story.dto.StoryPublicResponse;
import com.storydream.backend.domain.story.dto.StoryRecommendationResponse;
import com.storydream.backend.domain.story.service.StoryServiceImpl;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequiredArgsConstructor // final 필드를 채우는 생성자 자동 생성
@RequestMapping("/api/stories")
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Story", description = "동화 관련 API")
public class StoryController {

    private final StoryServiceImpl storyService;

    @Operation(
            summary = "비로그인 사용자용 공개 동화 목록 조회",
            description = """
                    로그인 및 아동 선택 없이 공개 동화 목록을 조회합니다.
                    언어별 공개 대상 동화를 ID 순으로 반환하며 제목, 태그, 표지 URL과 페이지 정보를 제공합니다.
                    page는 0부터 시작하고 size는 1~25까지 지정할 수 있습니다.
                    """,
            security = {}
    )
    @io.swagger.v3.oas.annotations.security.SecurityRequirements
    @GetMapping("/public")
    public ResponseEntity<ApiResponse<StoryPublicResponse>> getPublicStories(
            @Parameter(description = "동화 언어 (ko: 한국어, en: 영어)", example = "ko")
            @RequestParam(defaultValue = "ko") String languageCode,
            @Parameter(description = "페이지 번호 (0부터 시작)", example = "0")
            @RequestParam(defaultValue = "0") Integer page,
            @Parameter(description = "페이지당 동화 수 (1~25)", example = "4")
            @RequestParam(defaultValue = "4") Integer size
    ) {
        return ResponseEntity.ok(ApiResponse.success(storyService.getPublicStories(languageCode, page, size)));
    }

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
            Authentication authentication,

            @Parameter(description = "추천 동화를 조회할 아동 ID", example = "1")
            @RequestParam Integer childId,

            @Parameter(description = "조회할 동화 언어 (ko, en)", example = "ko")
            @RequestParam String languageCode,

            @Parameter(description = "조회할 페이지 번호 (0부터 시작)", example = "0")
            @RequestParam Integer page,

            @Parameter(description = "한 페이지에 보여줄 동화 개수", example = "4")
            @RequestParam Integer size
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());
        return ResponseEntity.ok( // 상태 코드를 포함하는 응답 객체 생성
                ApiResponse.success( // success, data, message 형태로 감싸는 객체
                        storyService.getRecommendations(guardianId, childId, languageCode, page, size) // service 호출 -> StoryRecommendationResponse 반환
                )
        );

    }

    @Operation(
            summary = "동화 상세 조회",
            description = """
                선택한 동화의 특정 난이도(level)에 해당하는 상세 내용을 조회합니다.

                - originalStoryId : 조회할 원본 동화 ID
                - level : 조회할 동화 난이도
                """
    )
    @GetMapping("/{originalStoryId}")
    public ResponseEntity<ApiResponse<StoryDetailResponse>> getStoryDetail(
            @Parameter(description = "조회할 원본 동화 ID", example = "1")
            @PathVariable Integer originalStoryId,

            @Parameter(description = "조회할 동화 난이도", example = "1")
            @RequestParam Integer level
    ) {
        return ResponseEntity.ok(
                ApiResponse.success(
                        storyService.getStoryDetail(originalStoryId, level)
                )
        );
    }

}
