package com.storydream.backend.domain.reading.dto;

import jakarta.validation.constraints.NotNull;

public record ReadingStartRequest(

        @NotNull
        Integer childId,

        @NotNull
        Integer originalStoryId
) {
}