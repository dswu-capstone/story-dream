//package com.storydream.backend.domain.focus.dto;
//
//import com.storydream.backend.global.common.PartType;
//import jakarta.validation.constraints.*;
//
//import java.time.LocalDateTime;
//
//public record FocusEventRequest(
//        @NotBlank String eventType,
//        @NotBlank String state,
//        String detail,
//        @NotNull PartType partType,
//        @NotNull @Min(1) @Max(3) Integer level,
//        LocalDateTime occurredAt
//) {}


package com.storydream.backend.domain.focus.dto;

import com.storydream.backend.global.common.PartType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;

@Schema(description = "집중도 이탈 이벤트 요청")
public record FocusEventRequest(

        @Schema(description = "이벤트 종류", example = "focus_lost",
                allowableValues = {"focus_lost", "absent", "focus_recovered", "focus_state"})
        @NotBlank String eventType,

        @Schema(description = "감지된 자세", example = "SIDE",
                allowableValues = {"FRONT", "SIDE", "BACK", "ABSENT"})
        @NotBlank String state,

        @Schema(description = "지속 시간 문자열", example = "distracted_for=10.3s")
        String detail,

        @Schema(description = "이벤트가 발생한 구간", example = "BODY")
        @NotNull PartType partType,

        @Schema(description = "해당 구간의 진행 난이도", example = "2")
        @NotNull @Min(1) @Max(3) Integer level,

        @Schema(description = "이벤트 발생 시각", example = "2026-05-01T14:30:00")
        LocalDateTime occurredAt
) {}