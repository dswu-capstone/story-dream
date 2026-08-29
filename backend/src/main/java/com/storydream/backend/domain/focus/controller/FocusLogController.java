//package com.storydream.backend.domain.focus.controller;
//
//import com.storydream.backend.domain.focus.dto.FocusEventRequest;
//import com.storydream.backend.domain.focus.service.FocusLogService;
//import jakarta.validation.Valid;
//import lombok.RequiredArgsConstructor;
//import org.springframework.http.ResponseEntity;
//import org.springframework.web.bind.annotation.*;
//
//import java.util.Map;
//
//@RestController
//@RequestMapping("/api/v1/reading-histories/{historyId}/focus-events")
//@RequiredArgsConstructor
//public class FocusLogController {
//
//    private final FocusLogService focusLogService;
//
//    @PostMapping
//    public ResponseEntity<Map<String, Object>> handle(
//            @PathVariable Integer historyId,
//            @Valid @RequestBody FocusEventRequest request) {
//
//        Integer logId = focusLogService.handleEvent(historyId, request);
//        return ResponseEntity.ok(Map.of("saved", logId != null, "logId", logId == null ? -1 : logId));
//    }
//}



package com.storydream.backend.domain.focus.controller;

import com.storydream.backend.domain.focus.dto.FocusEventRequest;
import com.storydream.backend.domain.focus.service.FocusLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "Focus Log", description = "집중도 이탈 로그 관련 API")
@RestController
@RequestMapping("/api/reading-histories/{historyId}/focus-events")
@RequiredArgsConstructor
public class FocusLogController {

    private final FocusLogService focusLogService;

    @Operation(
            summary = "집중도 이탈 이벤트 저장",
            description = """
                    YOLO Pose가 감지한 집중도 이벤트를 저장합니다.

                    - `historyId` : 진행 중인 독서 기록 ID
                    - `eventType` : `focus_lost`(옆/뒤돌아봄) / `absent`(자리 이탈) / `focus_recovered`(복귀) / `focus_state`(하트비트)
                    - `state` : `FRONT` / `SIDE` / `BACK` / `ABSENT`
                    - `partType` : 이벤트가 발생한 구간 (`INTRO` / `BODY` / `CONCLUSION`)
                    - `level` : 해당 구간의 진행 난이도 (1~3)
                    - `detail` : 지속 시간 문자열 (예: `distracted_for=10.3s`)
                    - `occurredAt` : 이벤트 발생 시각 (`yyyy-MM-dd'T'HH:mm:ss`)

                    `focus_lost`와 `absent`는 새 행을 저장하고, `focus_recovered`는 아직 닫히지 않은 \
                    가장 최근 이탈의 종료 시각을 기록합니다. `focus_state`는 5초마다 오는 하트비트라 저장하지 않습니다.

                    Edge Device(Raspberry Pi)에서 실행되는 Node 서버가 호출하는 내부 API입니다.
                    """
    )
    @PostMapping
    public ResponseEntity<Map<String, Object>> handle(
            @Parameter(description = "진행 중인 독서 기록 ID", example = "1")
            @PathVariable Integer historyId,

            @Valid @RequestBody FocusEventRequest request) {

        Integer logId = focusLogService.handleEvent(historyId, request);
        return ResponseEntity.ok(Map.of("saved", logId != null, "logId", logId == null ? -1 : logId));
    }
}