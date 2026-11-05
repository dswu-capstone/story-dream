package com.storydream.backend.domain.recommendation.service;

import com.storydream.backend.domain.recommendation.event.RecommendationCacheInvalidatedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class RecommendationCacheEventHandler {

    private final CacheManager cacheManager;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(RecommendationCacheInvalidatedEvent event) {
        Cache cache = cacheManager.getCache("storyRecommendations");
        if (cache != null) {
            cache.evict(event.childId() + ":" + event.languageCode());
        }
    }
}
