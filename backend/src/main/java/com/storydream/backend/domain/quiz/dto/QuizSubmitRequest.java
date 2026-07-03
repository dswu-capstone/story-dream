package com.storydream.backend.domain.quiz.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record QuizSubmitRequest(
        @NotNull Integer readingHistoryId,
        @NotBlank String selectedAnswer
) {
}