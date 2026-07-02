package com.storydream.backend.domain.reading.controller;

import com.storydream.backend.domain.reading.dto.ReadingStartRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartResponse;
import com.storydream.backend.domain.reading.service.ReadingService;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/reading-histories")
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Reading", description = "동화 읽기 관련 API")
public class ReadingController {

    private final ReadingService readingService;

    @Operation(
            summary = "동화 읽기 시작",
            description = """
                    선택한 동화의 독서 기록을 생성합니다.
                    
                    - childId : 동화를 읽을 아동 ID
                    - originalStoryId : 읽기를 시작할 원본 동화 ID
                    
                    독서 기록을 생성한 후 readingHistoryId를 반환합니다.
                    """
    )
    @PostMapping("/start")
    public ResponseEntity<ApiResponse<ReadingStartResponse>> startReading(

            Authentication authentication,

            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "동화 읽기 시작 요청",
                    required = true
            )
            @Valid @RequestBody ReadingStartRequest request
    ) {

        Integer guardianId = Integer.valueOf(authentication.getName());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(
                        ApiResponse.success(
                                readingService.startReading(
                                        guardianId,
                                        request
                                )
                        )
                );
    }
}