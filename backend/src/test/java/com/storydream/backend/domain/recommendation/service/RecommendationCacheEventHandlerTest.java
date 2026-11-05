package com.storydream.backend.domain.recommendation.service;

import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;
import com.storydream.backend.domain.recommendation.event.RecommendationCacheInvalidatedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringJUnitConfig(RecommendationCacheEventHandlerTest.Config.class)
class RecommendationCacheEventHandlerTest {

    @Autowired private ApplicationEventPublisher eventPublisher;
    @Autowired private CacheManager cacheManager;
    @Autowired private PlatformTransactionManager transactionManager;

    private Cache cache;

    @BeforeEach
    void setUp() {
        cache = cacheManager.getCache("storyRecommendations");
        cache.clear();
        cache.put("1:ko", "cached");
        cache.put("1:en", "cached");
        cache.put("2:ko", "cached");
    }

    @Test
    void evictsOnlyTargetLanguageAfterCommit() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            publishInvalidation();
            assertThat(cache.get("1:ko")).isNotNull();
        });

        assertThat(cache.get("1:ko")).isNull();
        assertThat(cache.get("1:en")).isNotNull();
        assertThat(cache.get("2:ko")).isNotNull();
    }

    @Test
    void rollbackPreservesCache() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            publishInvalidation();
            status.setRollbackOnly();
        });

        assertThat(cache.get("1:ko")).isNotNull();
    }

    private void publishInvalidation() {
        eventPublisher.publishEvent(new RecommendationCacheInvalidatedEvent(
                1,
                "ko",
                RecommendationInvalidationReason.CLICK_THRESHOLD
        ));
    }

    @Configuration
    @EnableTransactionManagement
    @Import(RecommendationCacheEventHandler.class)
    static class Config {
        @Bean
        CacheManager cacheManager() {
            return new ConcurrentMapCacheManager("storyRecommendations");
        }

        @Bean
        PlatformTransactionManager transactionManager() {
            return new DataSourceTransactionManager(
                    new DriverManagerDataSource(
                            "jdbc:h2:mem:recommendation-cache;DB_CLOSE_DELAY=-1",
                            "sa",
                            ""
                    )
            );
        }
    }
}
