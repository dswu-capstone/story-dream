package com.storydream.backend.domain.focus.controller;

import com.storydream.backend.domain.focus.dto.FocusEventRequest;
import com.storydream.backend.domain.focus.service.FocusLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/reading-histories/{historyId}/focus-events")
@RequiredArgsConstructor
public class FocusLogController {

    private final FocusLogService focusLogService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> handle(
            @PathVariable Integer historyId,
            @Valid @RequestBody FocusEventRequest request) {

        Integer logId = focusLogService.handleEvent(historyId, request);
        return ResponseEntity.ok(Map.of("saved", logId != null, "logId", logId == null ? -1 : logId));
    }
}
