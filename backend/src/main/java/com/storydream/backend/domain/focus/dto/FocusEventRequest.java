package com.storydream.backend.domain.focus.dto;

import com.storydream.backend.global.common.PartType;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;

public record FocusEventRequest(
        @NotBlank String eventType,
        @NotBlank String state,
        String detail,
        @NotNull PartType partType,
        @NotNull @Min(1) @Max(3) Integer level,
        LocalDateTime occurredAt
) {}
