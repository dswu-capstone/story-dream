package com.storydream.backend.domain.reading.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 문단 하나를 다 읽었을 때 호출.
 * partType : 서론 / 본론 / 결론
 * level    : 그 문단을 읽을 때 사용한 난이도(1~3)
 */
public record ReadingLogRequest(
        @NotBlank String partType,
        @NotNull @Min(1) @Max(3) Integer level
) {
}