package com.storydream.backend.domain.quiz.service;

import com.storydream.backend.domain.focus.repository.FocusLogRepository;
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
import com.storydream.backend.domain.reading.service.DifficultyDecision;
import com.storydream.backend.domain.reading.service.DifficultyDecisionService;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.global.common.PartType;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InOrder;

import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class QuizServiceImplTest {

    private static final int HISTORY_ID = 10;
    private static final int QUIZ_ID = 20;
    private static final String PART_TYPE = "서론";

    private final QuizRepository quizRepository = mock(QuizRepository.class);
    private final QuizResultRepository quizResultRepository = mock(QuizResultRepository.class);
    private final ReadingHistoryRepository readingHistoryRepository = mock(ReadingHistoryRepository.class);
    private final ReadingLogRepository readingLogRepository = mock(ReadingLogRepository.class);
    private final DifficultyDecisionService difficultyDecisionService = mock(DifficultyDecisionService.class);

    private QuizServiceImpl quizService;
    private Quiz quiz;

    @BeforeEach
    void setUp() {
        quizService = new QuizServiceImpl(
                quizRepository,
                quizResultRepository,
                readingHistoryRepository,
                readingLogRepository,
                difficultyDecisionService
        );
        quiz = mockQuiz(PART_TYPE);

        when(quizRepository.findById(QUIZ_ID)).thenReturn(Optional.of(quiz));
        when(readingHistoryRepository.findByIdForUpdate(HISTORY_ID))
                .thenReturn(Optional.of(mock(ReadingHistory.class)));
        when(readingLogRepository.findTopByReadingHistoryIdOrderByIdDesc(HISTORY_ID))
                .thenReturn(Optional.of(readingLog(PART_TYPE, 2)));
        when(quizResultRepository.findByReadingHistoryIdAndQuizId(HISTORY_ID, QUIZ_ID))
                .thenReturn(Optional.empty());
    }

    @Test
    void regularQuizSavesResultWithoutDifficultyDecision() {
        when(quizRepository.existsByOriginalStoryIdAndPartTypeAndOrderNumGreaterThan(1, PART_TYPE, 5))
                .thenReturn(true);

        QuizSubmitResponse response = submit("정답");

        verify(quizResultRepository).saveAndFlush(any(QuizResult.class));
        verifyNoInteractions(difficultyDecisionService);
        assertThat(response.lastQuizOfPart()).isFalse();
        assertThat(response.recommendedLevel()).isEqualTo(2);
    }

    @Test
    void lastQuizIsFlushedBeforeDifficultyDecisionAndReturnsNextLevel() {
        givenLastQuizDecision(DifficultyDecision.UP, 3);

        QuizSubmitResponse response = submit("정답");

        InOrder order = inOrder(quizResultRepository, difficultyDecisionService);
        order.verify(quizResultRepository).saveAndFlush(any(QuizResult.class));
        order.verify(difficultyDecisionService).decide(HISTORY_ID, PART_TYPE);
        assertThat(response.recommendedLevel()).isEqualTo(3);
    }

    @Test
    void lastCorrectAnswerIsSavedBeforeCorrectCountIsCalculated() {
        FocusLogRepository focusLogRepository = mock(FocusLogRepository.class);
        DifficultyDecisionService realDecisionService = new DifficultyDecisionService(
                quizResultRepository,
                focusLogRepository,
                readingLogRepository
        );
        QuizServiceImpl serviceWithRealDecision = new QuizServiceImpl(
                quizRepository,
                quizResultRepository,
                readingHistoryRepository,
                readingLogRepository,
                realDecisionService
        );
        when(quizRepository.existsByOriginalStoryIdAndPartTypeAndOrderNumGreaterThan(1, PART_TYPE, 5))
                .thenReturn(false);
        when(readingLogRepository.findTopByReadingHistoryIdAndPartTypeOrderByIdDesc(HISTORY_ID, PART_TYPE))
                .thenReturn(Optional.of(readingLog(PART_TYPE, 2)));
        when(quizResultRepository.countCorrectByReadingHistoryIdAndPartType(HISTORY_ID, PART_TYPE))
                .thenReturn(4L);
        when(focusLogRepository.countByReadingHistoryIdAndPartType(HISTORY_ID, PartType.INTRO))
                .thenReturn(1L);

        QuizSubmitResponse response = serviceWithRealDecision.submitQuiz(
                QUIZ_ID,
                new QuizSubmitRequest(HISTORY_ID, "정답")
        );

        InOrder order = inOrder(quizResultRepository);
        order.verify(quizResultRepository).saveAndFlush(any(QuizResult.class));
        order.verify(quizResultRepository)
                .countCorrectByReadingHistoryIdAndPartType(HISTORY_ID, PART_TYPE);
        assertThat(response.recommendedLevel()).isEqualTo(3);
    }

    @Test
    void duplicateSubmissionReturnsFirstResultWithoutSavingAgain() {
        when(quizRepository.existsByOriginalStoryIdAndPartTypeAndOrderNumGreaterThan(1, PART_TYPE, 5))
                .thenReturn(true);
        QuizResult existingResult = mock(QuizResult.class);
        when(existingResult.getIsCorrect()).thenReturn(true);
        when(quizResultRepository.findByReadingHistoryIdAndQuizId(HISTORY_ID, QUIZ_ID))
                .thenReturn(Optional.of(existingResult));

        QuizSubmitResponse response = submit("오답");

        verify(quizResultRepository, never()).saveAndFlush(any());
        verifyNoInteractions(difficultyDecisionService);
        assertThat(response.isCorrect()).isTrue();
        assertThat(response.recommendedLevel()).isEqualTo(2);
    }

    @Test
    void rejectsQuizFromDifferentPart() {
        quiz = mockQuiz("본론");
        when(quizRepository.findById(QUIZ_ID)).thenReturn(Optional.of(quiz));

        assertThatThrownBy(() -> submit("정답"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.QUIZ_PART_MISMATCH);

        verify(quizResultRepository, never()).saveAndFlush(any());
        verifyNoInteractions(difficultyDecisionService);
    }

    @ParameterizedTest
    @MethodSource("difficultyDecisions")
    void lastQuizReturnsLevelCalculatedByDifficultyService(
            DifficultyDecision decision,
            int nextLevel
    ) {
        givenLastQuizDecision(decision, nextLevel);

        QuizSubmitResponse response = submit("정답");

        assertThat(response.recommendedLevel()).isEqualTo(nextLevel);
        verify(difficultyDecisionService).decide(HISTORY_ID, PART_TYPE);
    }

    private static Stream<Arguments> difficultyDecisions() {
        return Stream.of(
                Arguments.of(DifficultyDecision.UP, 3),
                Arguments.of(DifficultyDecision.KEEP, 2),
                Arguments.of(DifficultyDecision.DOWN, 1)
        );
    }

    private void givenLastQuizDecision(DifficultyDecision decision, int nextLevel) {
        when(quizRepository.existsByOriginalStoryIdAndPartTypeAndOrderNumGreaterThan(1, PART_TYPE, 5))
                .thenReturn(false);
        when(difficultyDecisionService.decide(HISTORY_ID, PART_TYPE))
                .thenReturn(new DifficultyDecisionResult(decision, 4, 1, 2, nextLevel));
    }

    private QuizSubmitResponse submit(String selectedAnswer) {
        return quizService.submitQuiz(
                QUIZ_ID,
                new QuizSubmitRequest(HISTORY_ID, selectedAnswer)
        );
    }

    private Quiz mockQuiz(String partType) {
        Quiz result = mock(Quiz.class);
        OriginalStory originalStory = mock(OriginalStory.class);
        when(originalStory.getId()).thenReturn(1);
        when(result.getOriginalStory()).thenReturn(originalStory);
        when(result.getPartType()).thenReturn(partType);
        when(result.getOrderNum()).thenReturn(5);
        when(result.getAnswer()).thenReturn("정답");
        return result;
    }

    private ReadingLog readingLog(String partType, int level) {
        return ReadingLog.builder()
                .partType(partType)
                .level(level)
                .build();
    }
}
