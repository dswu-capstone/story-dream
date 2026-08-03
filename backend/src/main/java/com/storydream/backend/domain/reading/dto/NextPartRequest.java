package com.storydream.backend.domain.reading.dto;

import jakarta.validation.constraints.NotNull;

public record NextPartRequest(
        @NotNull
        Integer selectedLevel
) {
}
