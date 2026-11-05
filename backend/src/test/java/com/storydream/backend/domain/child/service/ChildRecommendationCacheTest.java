package com.storydream.backend.domain.child.service;

import com.storydream.backend.domain.child.dto.ChildUpdateRequest;
import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.guardian.repository.GuardianRepository;
import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;
import com.storydream.backend.domain.recommendation.repository.RecommendationRepository;
import com.storydream.backend.domain.recommendation.service.ChildRecommendationLifecycleEventHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(ChildRecommendationCacheTest.Config.class)
class ChildRecommendationCacheTest {

    @Autowired private ChildService childService;
    @Autowired private ChildRepository childRepository;
    @Autowired private RecommendationRepository recommendationRepository;
    @Autowired private CacheManager cacheManager;
    @Autowired private PlatformTransactionManager transactionManager;

    private Cache cache;

    @BeforeEach
    void setUp() {
        reset(childRepository);
        reset(recommendationRepository);
        Child child = Child.builder()
                .name("child")
                .birthDate(LocalDate.of(2020, 1, 1))
                .defaultLevel(1)
                .interest(new String[]{"동물"})
                .build();
        when(childRepository.findByIdAndGuardianId(1, 10)).thenReturn(Optional.of(child));
        cache = cacheManager.getCache("storyRecommendations");
        cache.clear();
        for (String key : new String[]{"1:ko", "1:en", "2:ko", "2:en"}) {
            cache.put(key, "cached");
        }
    }

    @Test
    void changedInterestsEvictBothLanguagesOnlyAfterCommit() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            childService.updateChild(10, 1, request(new String[]{"우주"}));
            assertChildCachePresent();
        });

        assertThat(cache.get("1:ko")).isNull();
        assertThat(cache.get("1:en")).isNull();
        assertThat(cache.get("2:ko", String.class)).isEqualTo("cached");
        assertThat(cache.get("2:en", String.class)).isEqualTo("cached");
        verify(recommendationRepository).invalidateAllActive(
                eq(1),
                any(),
                eq(RecommendationInvalidationReason.INTEREST_CHANGED)
        );
    }

    @Test
    void equalArrayContentsPreserveCache() {
        childService.updateChild(10, 1, request(new String[]{"동물"}));
        assertChildCachePresent();
    }

    @Test
    void otherProfileChangesWithEqualInterestsPreserveCache() {
        childService.updateChild(10, 1, new ChildUpdateRequest(
                "new name", LocalDate.of(2021, 2, 2), 2, new String[]{"동물"}));
        assertChildCachePresent();
    }

    @Test
    void omittedInterestsPreserveCache() {
        childService.updateChild(10, 1, new ChildUpdateRequest("new name", null, null, null));
        assertChildCachePresent();
    }

    @Test
    void rolledBackUpdatePreservesCache() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            childService.updateChild(10, 1, request(new String[]{"우주"}));
            status.setRollbackOnly();
        });
        assertChildCachePresent();
    }

    @Test
    void deletionEvictsOnlyDeletedChildAfterCommit() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            childService.deleteChild(10, 1);
            assertChildCachePresent();
        });
        verify(childRepository).delete(any(Child.class));
        verifyNoInteractions(recommendationRepository);
        assertThat(cache.get("1:ko")).isNull();
        assertThat(cache.get("1:en")).isNull();
        assertThat(cache.get("2:ko")).isNotNull();
        assertThat(cache.get("2:en")).isNotNull();
    }

    @Test
    void rolledBackDeletionPreservesCache() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            childService.deleteChild(10, 1);
            status.setRollbackOnly();
        });
        assertChildCachePresent();
    }

    private ChildUpdateRequest request(String[] interests) {
        return new ChildUpdateRequest(null, null, null, interests);
    }

    private void assertChildCachePresent() {
        assertThat(cache.get("1:ko", String.class)).isEqualTo("cached");
        assertThat(cache.get("1:en", String.class)).isEqualTo("cached");
    }

    @Configuration
    @EnableTransactionManagement
    @Import({
            ChildServiceImpl.class,
            ChildRecommendationCacheEventHandler.class,
            ChildRecommendationLifecycleEventHandler.class
    })
    static class Config {
        @Bean
        ChildRepository childRepository() {
            return mock(ChildRepository.class);
        }

        @Bean
        GuardianRepository guardianRepository() {
            return mock(GuardianRepository.class);
        }

        @Bean
        RecommendationRepository recommendationRepository() {
            return mock(RecommendationRepository.class);
        }

        @Bean
        CacheManager cacheManager() {
            return new ConcurrentMapCacheManager("storyRecommendations");
        }

        @Bean
        PlatformTransactionManager transactionManager() {
            return new DataSourceTransactionManager(
                    new DriverManagerDataSource("jdbc:h2:mem:child-cache;DB_CLOSE_DELAY=-1", "sa", ""));
        }
    }
}
