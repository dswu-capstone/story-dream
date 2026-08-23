package com.storydream.backend.domain.focus.dto;

import com.storydream.backend.domain.focus.entity.FocusStatus;
import com.storydream.backend.global.common.PartType;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;

public record FocusLogCreateRequest(
        @NotNull PartType partType,
        @NotNull @Min(1) @Max(3) Integer level,
        @NotNull FocusStatus status,
        @NotNull LocalDateTime startedAt,
        LocalDateTime endedAt
) {}
