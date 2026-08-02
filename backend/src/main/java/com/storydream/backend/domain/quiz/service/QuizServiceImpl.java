package com.storydream.backend.domain.quiz.service;

import com.storydream.backend.domain.quiz.dto.QuizListResponse;
import com.storydream.backend.domain.quiz.dto.QuizResponse;
import com.storydream.backend.domain.quiz.dto.QuizSubmitRequest;
import com.storydream.backend.domain.quiz.dto.QuizSubmitResponse;
import com.storydream.backend.domain.quiz.entity.Quiz;
import com.storydream.backend.domain.quiz.entity.QuizResult;
import com.storydream.backend.domain.quiz.repository.QuizRepository;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
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
    private final QuizResultRepository quizResultRepository;
    private final ReadingHistoryRepository readingHistoryRepository;


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

    @Override
    @Transactional
    public QuizSubmitResponse submitQuiz(
            Integer quizId,
            QuizSubmitRequest request
    ) {
        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() ->
                        new BusinessException(ErrorCode.QUIZ_NOT_FOUND)
                );

        ReadingHistory readingHistory = readingHistoryRepository
                .findById(request.readingHistoryId())
                .orElseThrow(() ->
                        new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND)
                );

        boolean isCorrect = quiz.getAnswer()
                .equals(request.selectedAnswer());

        QuizResult quizResult = QuizResult.builder()
                .readingHistory(readingHistory)
                .quiz(quiz)
                .selectedAnswer(request.selectedAnswer())
                .isCorrect(isCorrect)
                .build();

        quizResultRepository.save(quizResult);

        // 해당 파트에 다음 퀴즈 존재 여부 조회
        boolean hasNextQuiz = quizRepository.existsByOriginalStoryIdAndPartTypeAndOrderNumGreaterThan(
                quiz.getOriginalStory().getId(),
                quiz.getPartType(),
                quiz.getOrderNum()
        );

        boolean isLastQuizOfPart = !hasNextQuiz;

        return new QuizSubmitResponse(
                isCorrect,
                quiz.getAnswer(),
                isLastQuizOfPart,
                null // 난이도 변경 로직은 추후에 추가
        );
    }

    private void validatePartType(String partType) {
        if (!partType.equals("서론")
                && !partType.equals("본론")
                && !partType.equals("결론")) {
            throw new BusinessException(ErrorCode.INVALID_PART_TYPE);
        }
    }


}