package com.storydream.backend.domain.recommendation.service;

import com.storydream.backend.domain.child.event.ChildRecommendationInvalidatedEvent;
import com.storydream.backend.domain.child.event.ChildRecommendationInvalidationReason;
import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;
import com.storydream.backend.domain.recommendation.repository.RecommendationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Component
@RequiredArgsConstructor
public class ChildRecommendationLifecycleEventHandler {

    private final RecommendationRepository recommendationRepository;

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void handle(ChildRecommendationInvalidatedEvent event) {
        if (event.reason() != ChildRecommendationInvalidationReason.INTEREST_CHANGED) {
            return;
        }

        recommendationRepository.invalidateAllActive(
                event.childId(),
                OffsetDateTime.now(ZoneOffset.UTC),
                RecommendationInvalidationReason.INTEREST_CHANGED
        );
    }
}
