package com.storydream.backend.domain.child.service;

import com.storydream.backend.domain.child.event.ChildRecommendationInvalidatedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class ChildRecommendationCacheEventHandler {

    private final CacheManager cacheManager;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ChildRecommendationInvalidatedEvent event) {
        Cache cache = cacheManager.getCache("storyRecommendations");
        if (cache != null) {
            cache.evict(event.childId() + ":ko");
            cache.evict(event.childId() + ":en");
        }
    }
}
