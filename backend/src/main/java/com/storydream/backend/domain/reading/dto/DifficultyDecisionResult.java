package com.storydream.backend.domain.reading.dto;

import com.storydream.backend.domain.reading.service.DifficultyDecision;

public record DifficultyDecisionResult(
        DifficultyDecision decision,
        long correctCount,
        long distractionCount,
        Integer currentLevel,
        Integer nextLevel
) {
}
