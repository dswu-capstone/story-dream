package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.focus.repository.FocusLogRepository;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
import com.storydream.backend.domain.reading.dto.DifficultyDecisionResult;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.global.common.PartType;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DifficultyDecisionService {

    private static final int MIN_LEVEL = 1;
    private static final int MAX_LEVEL = 3;

    private final QuizResultRepository quizResultRepository;
    private final FocusLogRepository focusLogRepository;
    private final ReadingLogRepository readingLogRepository;

    public DifficultyDecisionResult decide(Integer readingHistoryId, String partTypeValue) {
        PartType partType = parsePartType(partTypeValue);

        ReadingLog readingLog = readingLogRepository
                .findTopByReadingHistoryIdAndPartTypeOrderByIdDesc(
                        readingHistoryId,
                        partType.getDbValue()
                )
                .orElseThrow(() -> new BusinessException(ErrorCode.READING_LOG_NOT_FOUND));

        long correctCount = quizResultRepository
                .countCorrectByReadingHistoryIdAndPartType(
                        readingHistoryId,
                        partType.getDbValue()
                );
        long distractionCount = focusLogRepository
                .countByReadingHistoryIdAndPartType(readingHistoryId, partType);

        DifficultyDecision decision = determineDecision(correctCount, distractionCount);
        int currentLevel = readingLog.getLevel();
        int nextLevel = clampLevel(currentLevel + levelDelta(decision));

        return new DifficultyDecisionResult(
                decision,
                correctCount,
                distractionCount,
                currentLevel,
                nextLevel
        );
    }

    private PartType parsePartType(String partTypeValue) {
        try {
            return PartType.fromDbValue(partTypeValue);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.INVALID_PART_TYPE);
        }
    }

    private DifficultyDecision determineDecision(long correctCount, long distractionCount) {
        if (correctCount >= 4 && distractionCount <= 1) {
            return DifficultyDecision.UP;
        }
        if (correctCount <= 2 && distractionCount >= 3) {
            return DifficultyDecision.DOWN;
        }
        return DifficultyDecision.KEEP;
    }

    private int levelDelta(DifficultyDecision decision) {
        return switch (decision) {
            case UP -> 1;
            case KEEP -> 0;
            case DOWN -> -1;
        };
    }

    private int clampLevel(int level) {
        return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    }
}
