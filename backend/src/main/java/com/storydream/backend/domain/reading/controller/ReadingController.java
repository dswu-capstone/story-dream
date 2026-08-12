package com.storydream.backend.domain.reading.controller;

import com.storydream.backend.domain.reading.dto.NextPartRequest;
import com.storydream.backend.domain.reading.dto.NextPartResponse;
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

    @Operation(
            summary = "동화 읽기 종료",
            description = """
                진행 중인 동화 읽기 기록을 종료합니다.
                
                - readingHistoryId : 종료할 독서 기록 ID
                
                종료 시 endedAt이 저장되고 상태가 COMPLETED로 변경됩니다.
                """
    )
    @PatchMapping("/{readingHistoryId}/end")
    public ResponseEntity<ApiResponse<Void>> endReading(
            Authentication authentication,

            @Parameter(description = "종료할 독서 기록 ID", example = "15")
            @PathVariable Integer readingHistoryId
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        readingService.endReading(
                guardianId,
                readingHistoryId
        );

        return ResponseEntity.ok(
                ApiResponse.success(null)
        );
    }

    @Operation(
            summary = "다음 파트 시작 및 조회",
            description = """
                    현재 읽고 있는 파트의 다음 파트를 시작합니다.

                    - readingHistoryId : 현재 독서 기록 ID
                    - selectedLevel : 아이가 최종 선택한 다음 파트 난이도
                    """
    )
    @PostMapping("/{readingHistoryId}/next-part")
    public ResponseEntity<ApiResponse<NextPartResponse>> nextPart(
            Authentication authentication,

            @Parameter(
                    description = "현재 독서 기록 ID",
                    example = "15"
            )
            @PathVariable Integer readingHistoryId,

            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    description = "다음 파트 시작 요청",
                    required = true
            )
            @Valid @RequestBody NextPartRequest request
    ) {
        Integer guardianId = Integer.valueOf(authentication.getName());

        NextPartResponse response =
                readingService.startNextPart(
                        guardianId,
                        readingHistoryId,
                        request
                );

        return ResponseEntity.ok(
                ApiResponse.success(response)
        );
    }
}