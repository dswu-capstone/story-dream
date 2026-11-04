package com.storydream.backend.domain.recommendation.service;

import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.recommendation.dto.RecommendationExposureRequest;
import com.storydream.backend.domain.recommendation.dto.RecommendationExposureResponse;
import com.storydream.backend.domain.recommendation.dto.StoryClickResponse;
import com.storydream.backend.domain.recommendation.entity.RecommendationExposure;
import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;
import com.storydream.backend.domain.recommendation.entity.RecommendationItem;
import com.storydream.backend.domain.recommendation.entity.StoryClick;
import com.storydream.backend.domain.recommendation.repository.RecommendationExposureRepository;
import com.storydream.backend.domain.recommendation.repository.RecommendationItemRepository;
import com.storydream.backend.domain.recommendation.repository.StoryClickRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RecommendationLogService {

    private static final long DISTINCT_CLICK_THRESHOLD = 3L;

    private final RecommendationItemRepository recommendationItemRepository;
    private final RecommendationExposureRepository recommendationExposureRepository;
    private final StoryClickRepository storyClickRepository;
    private final ChildRepository childRepository;
    private final RecommendationInvalidationService recommendationInvalidationService;

    @Transactional
    public RecommendationExposureResponse recordExposure(
            Integer guardianId,
            Long recommendationId,
            RecommendationExposureRequest request
    ) {
        RecommendationItem item = recommendationItemRepository.findOwnedItemForUpdate(
                        recommendationId,
                        request.originalStoryId(),
                        guardianId
                )
                .orElseThrow(() -> new BusinessException(ErrorCode.RECOMMENDATION_ITEM_NOT_FOUND));

        RecommendationExposure existing = recommendationExposureRepository
                .findByRecommendationItemIdAndViewSessionId(item.getId(), request.viewSessionId())
                .orElse(null);

        if (existing != null) {
            return new RecommendationExposureResponse(existing.getId(), true);
        }

        RecommendationExposure saved = recommendationExposureRepository.save(
                new RecommendationExposure(item, request.viewSessionId())
        );
        return new RecommendationExposureResponse(saved.getId(), false);
    }

    @Transactional
    public StoryClickResponse recordClick(
            Integer guardianId,
            Long recommendationExposureId
    ) {
        RecommendationExposure exposure = recommendationExposureRepository
                .findOwnedExposureForUpdate(recommendationExposureId, guardianId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RECOMMENDATION_EXPOSURE_NOT_FOUND));

        StoryClick existing = storyClickRepository
                .findByRecommendationExposureId(recommendationExposureId)
                .orElse(null);

        if (existing != null) {
            return new StoryClickResponse(existing.getId(), true);
        }

        Integer childId = exposure.getRecommendationItem()
                .getRecommendation()
                .getChild()
                .getId();
        String languageCode = exposure.getRecommendationItem()
                .getRecommendation()
                .getLanguageCode();

        childRepository.findByIdForUpdate(childId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHILD_NOT_FOUND));

        StoryClick saved = storyClickRepository.saveAndFlush(new StoryClick(exposure));
        long distinctClickCount = storyClickRepository
                .countDistinctClickedStoriesInActiveCycle(childId, languageCode);

        if (distinctClickCount >= DISTINCT_CLICK_THRESHOLD) {
            recommendationInvalidationService.invalidateActive(
                    childId,
                    languageCode,
                    RecommendationInvalidationReason.CLICK_THRESHOLD
            );
        }

        return new StoryClickResponse(saved.getId(), false);
    }
}
