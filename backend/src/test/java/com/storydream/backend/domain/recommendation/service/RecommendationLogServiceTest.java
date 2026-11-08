package com.storydream.backend.domain.recommendation.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.recommendation.dto.RecommendationExposureRequest;
import com.storydream.backend.domain.recommendation.dto.RecommendationExposureResponse;
import com.storydream.backend.domain.recommendation.dto.StoryClickResponse;
import com.storydream.backend.domain.recommendation.entity.RecommendationExposure;
import com.storydream.backend.domain.recommendation.entity.Recommendation;
import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;
import com.storydream.backend.domain.recommendation.entity.RecommendationItem;
import com.storydream.backend.domain.recommendation.entity.StoryClick;
import com.storydream.backend.domain.recommendation.repository.RecommendationExposureRepository;
import com.storydream.backend.domain.recommendation.repository.RecommendationItemRepository;
import com.storydream.backend.domain.recommendation.repository.StoryClickRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RecommendationLogServiceTest {

    private RecommendationItemRepository itemRepository;
    private RecommendationExposureRepository exposureRepository;
    private StoryClickRepository clickRepository;
    private ChildRepository childRepository;
    private RecommendationInvalidationService invalidationService;
    private RecommendationLogService service;

    @BeforeEach
    void setUp() {
        itemRepository = mock(RecommendationItemRepository.class);
        exposureRepository = mock(RecommendationExposureRepository.class);
        clickRepository = mock(StoryClickRepository.class);
        childRepository = mock(ChildRepository.class);
        invalidationService = mock(RecommendationInvalidationService.class);
        service = new RecommendationLogService(
                itemRepository,
                exposureRepository,
                clickRepository,
                childRepository,
                invalidationService
        );
    }

    @Test
    void recordsExposureOncePerItemAndViewSession() {
        RecommendationItem item = mock(RecommendationItem.class);
        RecommendationExposure saved = mock(RecommendationExposure.class);
        when(item.getId()).thenReturn(10L);
        when(saved.getId()).thenReturn(20L);
        when(itemRepository.findOwnedItemForUpdate(1L, 101, 7))
                .thenReturn(Optional.of(item));
        when(exposureRepository.findByRecommendationItemIdAndViewSessionId(10L, "session-1"))
                .thenReturn(Optional.empty());
        when(exposureRepository.save(any(RecommendationExposure.class))).thenReturn(saved);

        RecommendationExposureResponse response = service.recordExposure(
                7,
                1L,
                new RecommendationExposureRequest(101, "session-1")
        );

        assertThat(response.recommendationExposureId()).isEqualTo(20L);
        assertThat(response.alreadyProcessed()).isFalse();
        verify(exposureRepository).save(any(RecommendationExposure.class));
    }

    @Test
    void repeatedExposureReturnsExistingLog() {
        RecommendationItem item = mock(RecommendationItem.class);
        RecommendationExposure existing = mock(RecommendationExposure.class);
        when(item.getId()).thenReturn(10L);
        when(existing.getId()).thenReturn(20L);
        when(itemRepository.findOwnedItemForUpdate(1L, 101, 7))
                .thenReturn(Optional.of(item));
        when(exposureRepository.findByRecommendationItemIdAndViewSessionId(10L, "session-1"))
                .thenReturn(Optional.of(existing));

        RecommendationExposureResponse response = service.recordExposure(
                7,
                1L,
                new RecommendationExposureRequest(101, "session-1")
        );

        assertThat(response.recommendationExposureId()).isEqualTo(20L);
        assertThat(response.alreadyProcessed()).isTrue();
        verify(exposureRepository, never()).save(any());
    }

    @Test
    void rejectsExposureOutsideGuardianOwnership() {
        when(itemRepository.findOwnedItemForUpdate(1L, 101, 7))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.recordExposure(
                7,
                1L,
                new RecommendationExposureRequest(101, "session-1")
        ))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.RECOMMENDATION_ITEM_NOT_FOUND);
    }

    @Test
    void recordsClickOnlyOncePerExposure() {
        RecommendationExposure exposure = givenOwnedClickExposure();
        StoryClick saved = mock(StoryClick.class);
        when(saved.getId()).thenReturn(30L);
        when(exposureRepository.findOwnedExposureForUpdate(20L, 7))
                .thenReturn(Optional.of(exposure));
        when(clickRepository.findByRecommendationExposureId(20L)).thenReturn(Optional.empty());
        when(clickRepository.saveAndFlush(any(StoryClick.class))).thenReturn(saved);
        when(clickRepository.countDistinctClickedStoriesInActiveCycle(11, "ko")).thenReturn(1L);

        StoryClickResponse response = service.recordClick(7, 20L);

        assertThat(response.storyClickId()).isEqualTo(30L);
        assertThat(response.alreadyProcessed()).isFalse();
        verify(clickRepository).saveAndFlush(any(StoryClick.class));
        verify(invalidationService, never()).invalidateActive(anyInt(), anyString(), any());
    }

    @Test
    void thirdDistinctStoryClickInvalidatesActiveRecommendationCycle() {
        RecommendationExposure exposure = givenOwnedClickExposure();
        StoryClick saved = mock(StoryClick.class);
        when(saved.getId()).thenReturn(30L);
        when(exposureRepository.findOwnedExposureForUpdate(20L, 7))
                .thenReturn(Optional.of(exposure));
        when(clickRepository.findByRecommendationExposureId(20L)).thenReturn(Optional.empty());
        when(clickRepository.saveAndFlush(any(StoryClick.class))).thenReturn(saved);
        when(clickRepository.countDistinctClickedStoriesInActiveCycle(11, "ko")).thenReturn(3L);

        StoryClickResponse response = service.recordClick(7, 20L);

        assertThat(response.alreadyProcessed()).isFalse();
        verify(invalidationService).invalidateActive(
                11,
                "ko",
                RecommendationInvalidationReason.CLICK_THRESHOLD
        );
    }

    @Test
    void repeatedClickReturnsExistingLog() {
        RecommendationExposure exposure = mock(RecommendationExposure.class);
        StoryClick existing = mock(StoryClick.class);
        when(existing.getId()).thenReturn(30L);
        when(exposureRepository.findOwnedExposureForUpdate(20L, 7))
                .thenReturn(Optional.of(exposure));
        when(clickRepository.findByRecommendationExposureId(20L))
                .thenReturn(Optional.of(existing));

        StoryClickResponse response = service.recordClick(7, 20L);

        assertThat(response.storyClickId()).isEqualTo(30L);
        assertThat(response.alreadyProcessed()).isTrue();
        verify(clickRepository, never()).saveAndFlush(any());
        verifyNoInteractions(childRepository, invalidationService);
    }

    private RecommendationExposure givenOwnedClickExposure() {
        Child child = mock(Child.class);
        Recommendation recommendation = mock(Recommendation.class);
        RecommendationItem item = mock(RecommendationItem.class);
        RecommendationExposure exposure = mock(RecommendationExposure.class);

        when(child.getId()).thenReturn(11);
        when(recommendation.getChild()).thenReturn(child);
        when(recommendation.getLanguageCode()).thenReturn("ko");
        when(item.getRecommendation()).thenReturn(recommendation);
        when(exposure.getRecommendationItem()).thenReturn(item);
        when(childRepository.findByIdForUpdate(11)).thenReturn(Optional.of(child));
        return exposure;
    }
}
