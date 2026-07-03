package com.storydream.backend.domain.quiz.service;

import com.storydream.backend.domain.quiz.dto.QuizListResponse;
import com.storydream.backend.domain.quiz.dto.QuizResponse;
import com.storydream.backend.domain.quiz.entity.Quiz;
import com.storydream.backend.domain.quiz.repository.QuizRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuizServiceImpl implements QuizService {

    private final QuizRepository quizRepository;

    @Override
    public QuizListResponse getQuizzes(Integer originalStoryId, String partType) {
        validatePartType(partType);

        List<Quiz> quizzes = quizRepository
                .findByOriginalStoryIdAndPartTypeOrderByOrderNumAsc(
                        originalStoryId,
                        partType
                );

        if (quizzes.isEmpty()) {
            throw new BusinessException(ErrorCode.QUIZ_NOT_FOUND);
        }

        List<QuizResponse> quizResponses = quizzes.stream()
                .map(quiz -> new QuizResponse(
                        quiz.getId(),
                        quiz.getQuestion(),
                        quiz.getType(),
                        quiz.getChoices()
                ))
                .toList();

        return new QuizListResponse(quizResponses);
    }

    private void validatePartType(String partType) {
        if (!partType.equals("서론")
                && !partType.equals("본론")
                && !partType.equals("결론")) {
            throw new BusinessException(ErrorCode.INVALID_PART_TYPE);
        }
    }
}