package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.focus.repository.FocusLogRepository;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
import com.storydream.backend.domain.reading.dto.DifficultyDecisionResult;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.global.common.PartType;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DifficultyDecisionServiceTest {

    private final QuizResultRepository quizResultRepository = mock(QuizResultRepository.class);
    private final FocusLogRepository focusLogRepository = mock(FocusLogRepository.class);
    private final ReadingLogRepository readingLogRepository = mock(ReadingLogRepository.class);

    private DifficultyDecisionService difficultyDecisionService;

    @BeforeEach
    void setUp() {
        difficultyDecisionService = new DifficultyDecisionService(
                quizResultRepository,
                focusLogRepository,
                readingLogRepository
        );
    }

    @Test
    void decidesUpAndLimitsNextLevelToThree() {
        givenPartData(5, 1, 3);

        DifficultyDecisionResult result = difficultyDecisionService.decide(1, PartType.INTRO.getDbValue());

        assertThat(result.decision()).isEqualTo(DifficultyDecision.UP);
        assertThat(result.correctCount()).isEqualTo(5);
        assertThat(result.distractionCount()).isEqualTo(1);
        assertThat(result.currentLevel()).isEqualTo(3);
        assertThat(result.nextLevel()).isEqualTo(3);
    }

    @Test
    void decidesKeepForExactKeepCondition() {
        givenPartData(3, 2, 2);

        DifficultyDecisionResult result = difficultyDecisionService.decide(1, PartType.INTRO.getDbValue());

        assertThat(result.decision()).isEqualTo(DifficultyDecision.KEEP);
        assertThat(result.nextLevel()).isEqualTo(2);
    }

    @Test
    void decidesDownAndLimitsNextLevelToOne() {
        givenPartData(2, 3, 1);

        DifficultyDecisionResult result = difficultyDecisionService.decide(1, PartType.INTRO.getDbValue());

        assertThat(result.decision()).isEqualTo(DifficultyDecision.DOWN);
        assertThat(result.nextLevel()).isEqualTo(1);
    }

    @Test
    void decidesKeepForCombinationOutsideExplicitRules() {
        givenPartData(4, 3, 2);

        DifficultyDecisionResult result = difficultyDecisionService.decide(1, PartType.INTRO.getDbValue());

        assertThat(result.decision()).isEqualTo(DifficultyDecision.KEEP);
        assertThat(result.nextLevel()).isEqualTo(2);
    }

    @Test
    void rejectsUnknownPartType() {
        assertThatThrownBy(() -> difficultyDecisionService.decide(1, "UNKNOWN"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_PART_TYPE);
    }

    private void givenPartData(long correctCount, long distractionCount, int currentLevel) {
        String partType = PartType.INTRO.getDbValue();
        ReadingLog readingLog = ReadingLog.builder()
                .partType(partType)
                .level(currentLevel)
                .build();

        when(readingLogRepository.findTopByReadingHistoryIdAndPartTypeOrderByIdDesc(1, partType))
                .thenReturn(Optional.of(readingLog));
        when(quizResultRepository.countCorrectByReadingHistoryIdAndPartType(1, partType))
                .thenReturn(correctCount);
        when(focusLogRepository.countByReadingHistoryIdAndPartType(1, PartType.INTRO))
                .thenReturn(distractionCount);
    }
}
