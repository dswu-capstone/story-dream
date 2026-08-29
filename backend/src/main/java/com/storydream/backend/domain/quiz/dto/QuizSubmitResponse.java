package com.storydream.backend.domain.quiz.dto;

public record QuizSubmitResponse(
        boolean isCorrect,
        String correctAnswer,
        boolean lastQuizOfPart,
        Integer recommendedLevel
) {
}