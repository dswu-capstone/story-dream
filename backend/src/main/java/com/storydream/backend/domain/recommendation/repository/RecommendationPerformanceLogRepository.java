package com.storydream.backend.domain.recommendation.repository;

import com.storydream.backend.domain.recommendation.entity.RecommendationPerformanceLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationPerformanceLogRepository
        extends JpaRepository<RecommendationPerformanceLog, Long> {
}
