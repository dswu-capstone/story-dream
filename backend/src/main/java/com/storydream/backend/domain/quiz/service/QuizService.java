package com.storydream.backend.domain.quiz.service;

import com.storydream.backend.domain.quiz.dto.QuizListResponse;

public interface QuizService {

    QuizListResponse getQuizzes(Integer originalStoryId, String partType);
}