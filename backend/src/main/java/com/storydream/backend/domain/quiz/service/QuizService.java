package com.storydream.backend.domain.quiz.service;

import com.storydream.backend.domain.quiz.dto.QuizListResponse;
import com.storydream.backend.domain.quiz.dto.QuizSubmitRequest;
import com.storydream.backend.domain.quiz.dto.QuizSubmitResponse;

public interface QuizService {

    QuizListResponse getQuizzes(Integer originalStoryId, String partType);

    QuizSubmitResponse submitQuiz(Integer quizId, QuizSubmitRequest request);
}