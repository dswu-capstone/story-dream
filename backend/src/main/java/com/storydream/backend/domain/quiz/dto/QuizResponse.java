package com.storydream.backend.domain.quiz.dto;

import java.util.List;

public record QuizResponse(
        Integer quizId,
        String question,
        String type,
        List<String> choices
) {
}