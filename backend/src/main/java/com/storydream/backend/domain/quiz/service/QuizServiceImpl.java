package com.storydream.backend.domain.quiz.service;

import com.storydream.backend.domain.quiz.dto.QuizListResponse;
import com.storydream.backend.domain.quiz.dto.QuizResponse;
import com.storydream.backend.domain.quiz.dto.QuizSubmitRequest;
import com.storydream.backend.domain.quiz.dto.QuizSubmitResponse;
import com.storydream.backend.domain.quiz.entity.Quiz;
import com.storydream.backend.domain.quiz.entity.QuizResult;
import com.storydream.backend.domain.quiz.repository.QuizRepository;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
import com.storydream.backend.domain.reading.dto.DifficultyDecisionResult;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.reading.service.DifficultyDecisionService;
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
    private final ReadingLogRepository readingLogRepository;
    private final DifficultyDecisionService difficultyDecisionService;


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
                .findByIdForUpdate(request.readingHistoryId())
                .orElseThrow(() ->
                        new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND)
                );

        ReadingLog currentReadingLog = readingLogRepository
                .findTopByReadingHistoryIdOrderByIdDesc(request.readingHistoryId())
                .orElseThrow(() -> new BusinessException(ErrorCode.READING_LOG_NOT_FOUND));

        if (!currentReadingLog.getPartType().equals(quiz.getPartType())) {
            throw new BusinessException(ErrorCode.QUIZ_PART_MISMATCH);
        }

        boolean hasNextQuiz = quizRepository.existsByOriginalStoryIdAndPartTypeAndOrderNumGreaterThan(
                quiz.getOriginalStory().getId(),
                quiz.getPartType(),
                quiz.getOrderNum()
        );
        boolean isLastQuizOfPart = !hasNextQuiz;

        QuizResult existingResult = quizResultRepository
                .findByReadingHistoryIdAndQuizId(request.readingHistoryId(), quizId)
                .orElse(null);

        if (existingResult != null) {
            return createSubmitResponse(
                    existingResult.getIsCorrect(),
                    quiz,
                    isLastQuizOfPart,
                    currentReadingLog.getLevel(),
                    request.readingHistoryId()
            );
        }

        boolean isCorrect = quiz.getAnswer()
                .equals(request.selectedAnswer());

        QuizResult quizResult = QuizResult.builder()
                .readingHistory(readingHistory)
                .quiz(quiz)
                .selectedAnswer(request.selectedAnswer())
                .isCorrect(isCorrect)
                .build();

        quizResultRepository.saveAndFlush(quizResult);

        return createSubmitResponse(
                isCorrect,
                quiz,
                isLastQuizOfPart,
                currentReadingLog.getLevel(),
                request.readingHistoryId()
        );
    }

    private QuizSubmitResponse createSubmitResponse(
            boolean isCorrect,
            Quiz quiz,
            boolean isLastQuizOfPart,
            Integer currentLevel,
            Integer readingHistoryId
    ) {
        Integer recommendedLevel = currentLevel;

        if (isLastQuizOfPart) {
            DifficultyDecisionResult decision = difficultyDecisionService.decide(
                    readingHistoryId,
                    quiz.getPartType()
            );
            recommendedLevel = decision.nextLevel();
        }

        return new QuizSubmitResponse(
                isCorrect,
                quiz.getAnswer(),
                isLastQuizOfPart,
                recommendedLevel
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
