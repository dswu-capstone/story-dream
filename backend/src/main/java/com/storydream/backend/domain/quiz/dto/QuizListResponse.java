package com.storydream.backend.domain.quiz.dto;

import java.util.List;

public record QuizListResponse(
        List<QuizResponse> quizzes
) {
}
