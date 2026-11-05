package com.storydream.backend.domain.recommendation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RecommendationExposureRequest(
        @NotNull
        Integer originalStoryId,

        @NotBlank
        @Size(max = 128)
        @Pattern(regexp = "\\S+", message = "viewSessionId must not contain whitespace")
        String viewSessionId
) {
}
