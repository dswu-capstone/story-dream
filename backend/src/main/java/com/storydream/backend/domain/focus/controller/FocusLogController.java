package com.storydream.backend.domain.focus.controller;

import com.storydream.backend.domain.focus.dto.FocusEventRequest;
import com.storydream.backend.domain.focus.dto.FocusEventResponse;
import com.storydream.backend.domain.focus.service.FocusLogService;
import com.storydream.backend.global.exception.ErrorCode;
import com.storydream.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Focus Log", description = "집중도 이탈 로그 관련 API")
@RestController
@RequestMapping("/api/reading-histories/{historyId}/focus-events")
@RequiredArgsConstructor
public class FocusLogController {
    private final FocusLogService focusLogService;

    @Operation(summary = "10초 이상 지속된 이탈 구간 저장 또는 복귀 처리", description = """
            eventId, occurredAt, durationSeconds를 전달합니다. partType과 level은 서버가 결정합니다.
            연속된 이탈에는 eventId 하나만 사용하며 재시도할 때 바꾸지 않습니다.
            선택 필드 eventType은 생략 시 focus_lost입니다. absent도 동일한 확정 이벤트입니다.
            focus_recovered는 동일 eventId의 종료 시간만 갱신하며 새 행을 만들지 않습니다.
            하트비트 및 확정되지 않은 이탈은 받지 않습니다.
            """)
    @PostMapping
    public ResponseEntity<ApiResponse<FocusEventResponse>> handle(
            @PathVariable Integer historyId, @Valid @RequestBody FocusEventRequest request) {
        return ResponseEntity.ok(ApiResponse.success(focusLogService.handleEvent(historyId, request)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableEvent(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(ApiResponse.error(ErrorCode.INVALID_FOCUS_EVENT.getMessage()));
    }
}
