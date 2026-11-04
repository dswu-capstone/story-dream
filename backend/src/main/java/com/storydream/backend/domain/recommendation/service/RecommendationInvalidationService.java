package com.storydream.backend.domain.recommendation.service;

import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;
import com.storydream.backend.domain.recommendation.event.RecommendationCacheInvalidatedEvent;
import com.storydream.backend.domain.recommendation.repository.RecommendationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class RecommendationInvalidationService {

    private final RecommendationRepository recommendationRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public int invalidateActive(
            Integer childId,
            String languageCode,
            RecommendationInvalidationReason reason
    ) {
        int invalidatedCount = recommendationRepository.invalidateActive(
                childId,
                languageCode,
                OffsetDateTime.now(ZoneOffset.UTC),
                reason
        );
        eventPublisher.publishEvent(
                new RecommendationCacheInvalidatedEvent(childId, languageCode, reason)
        );
        return invalidatedCount;
    }
}
