package com.storydream.backend.domain.recommendation.controller;

import com.storydream.backend.domain.recommendation.dto.RecommendationExposureRequest;
import com.storydream.backend.domain.recommendation.dto.RecommendationExposureResponse;
import com.storydream.backend.domain.recommendation.dto.StoryClickResponse;
import com.storydream.backend.domain.recommendation.service.RecommendationLogService;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Recommendation Log", description = "추천 노출 및 클릭 로그 API")
public class RecommendationLogController {

    private final RecommendationLogService recommendationLogService;

    @Operation(summary = "추천 동화 노출 기록")
    @PostMapping("/recommendations/{recommendationId}/exposures")
    public ResponseEntity<ApiResponse<RecommendationExposureResponse>> recordExposure(
            Authentication authentication,
            @PathVariable Long recommendationId,
            @Valid @RequestBody RecommendationExposureRequest request
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());
        return ResponseEntity.ok(ApiResponse.success(
                recommendationLogService.recordExposure(guardianId, recommendationId, request)
        ));
    }

    @Operation(summary = "추천 동화 클릭 기록")
    @PostMapping("/recommendation-exposures/{recommendationExposureId}/click")
    public ResponseEntity<ApiResponse<StoryClickResponse>> recordClick(
            Authentication authentication,
            @PathVariable Long recommendationExposureId
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());
        return ResponseEntity.ok(ApiResponse.success(
                recommendationLogService.recordClick(guardianId, recommendationExposureId)
        ));
    }
}
