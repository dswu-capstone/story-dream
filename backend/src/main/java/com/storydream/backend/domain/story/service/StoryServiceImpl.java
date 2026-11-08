package com.storydream.backend.domain.story.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.recommendation.entity.Recommendation;
import com.storydream.backend.domain.recommendation.entity.RecommendationItem;
import com.storydream.backend.domain.recommendation.entity.RecommendationPerformanceLog;
import com.storydream.backend.domain.recommendation.repository.RecommendationItemRepository;
import com.storydream.backend.domain.recommendation.repository.RecommendationPerformanceLogRepository;
import com.storydream.backend.domain.recommendation.repository.RecommendationRepository;
import com.storydream.backend.domain.recommendation.service.RecommendationBehaviorService;
import com.storydream.backend.domain.story.dto.*;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.domain.story.entity.StoryLevel;
import com.storydream.backend.domain.story.entity.StoryPage;
import com.storydream.backend.domain.story.entity.StoryPart;
import com.storydream.backend.domain.story.repository.*;
import com.storydream.backend.global.client.AiRecommendationClient;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import com.storydream.backend.global.storage.FileUrlProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class StoryServiceImpl implements StoryService {

    @Override
    public StoryPublicResponse getPublicStories(String languageCode, Integer page, Integer size) {
        List<Integer> ids;
        if ("ko".equals(languageCode)) {
            ids = List.of(4,11,13,15,17,19,20,24,25,26,27,29,31,106,108,111,112,114,115,116,118,123,126,128,129);
        } else if ("en".equals(languageCode)) {
            ids = List.of(50,52,54,55,58,61,68,70,71,77,78,81,82,85,89,90,91,94,132,133,138,139,142,148,153);
        } else {
            throw new BusinessException(ErrorCode.INVALID_LANGUAGE);
        }
        if (page == null || page < 0 || size == null || size < 1 || size > 25) {
            throw new BusinessException(ErrorCode.INVALID_STORY_PAGE);
        }
        Page<OriginalStory> result = originalStoryRepository.findByLanguageCodeAndIdInOrderByIdAsc(
                languageCode, ids, PageRequest.of(page, size));
        List<Integer> pageIds = result.getContent().stream().map(OriginalStory::getId).toList();
        Map<Integer, List<String>> tagsByStoryId = pageIds.isEmpty() ? Map.of()
                : storyMetadataRepository.findByOriginalStory_IdIn(pageIds).stream()
                .collect(Collectors.toMap(metadata -> metadata.getOriginalStory().getId(),
                        metadata -> java.util.Arrays.asList(metadata.getTags())));
        List<StoryPublicResponse.StoryPublic> stories = result.getContent().stream()
                .map(story -> new StoryPublicResponse.StoryPublic(
                        story.getId(), story.getTitle(), tagsByStoryId.getOrDefault(story.getId(), List.of()),
                        generateUrl(story.getCoverImageUrl())))
                .toList();
        return new StoryPublicResponse(stories, new StoryPublicResponse.PageInfo(
                result.getNumber(), result.getSize(), result.getTotalPages(), result.getTotalElements(),
                result.hasNext(), result.hasPrevious()));
    }

    private final OriginalStoryRepository originalStoryRepository;
    private final StoryMetadataRepository storyMetadataRepository;
    private final StoryLevelRepository storyLevelRepository;
    private final StoryPartRepository storyPartRepository;
    private final StorySentenceRepository storySentenceRepository;
    private final StoryPageRepository storyPageRepository;
    private final ChildRepository childRepository;
    private final RecommendationRepository recommendationRepository;
    private final RecommendationItemRepository recommendationItemRepository;
    private final RecommendationPerformanceLogRepository recommendationPerformanceLogRepository;
    private final RecommendationBehaviorService recommendationBehaviorService;
    private final CacheManager cacheManager;
    private final FileUrlProvider fileUrlProvider;

    // 추천 Client
    private final AiRecommendationClient aiRecommendationClient;

    @Value("${story.dataset.ko.generator-type}")
    private String koGeneratorType;

    @Value("${story.dataset.ko.version}")
    private String koVersion;

    @Value("${story.dataset.en.generator-type}")
    private String enGeneratorType;

    @Value("${story.dataset.en.version}")
    private String enVersion;


    @Override
    @Transactional
    public StoryRecommendationResponse getRecommendations(
            Integer guardianId,
            Integer childId,
            String languageCode,
            Integer page,
            Integer size
    ) {
        long totalStartedAt = System.nanoTime();
//        String generatorType;
//        String version;
//
//        if (languageCode.equals("ko")) {
//            generatorType = koGeneratorType;
//            version = koVersion;
//        } else {
//            generatorType = enGeneratorType;
//            version = enVersion;
//        }

        Pageable pageable = PageRequest.of(page, size);

//        Page<OriginalStory> storyPage =
//                originalStoryRepository.findActiveStories(
//                        languageCode,
//                        generatorType,
//                        version,
//                        pageable
//                );

        // ChildId로 child 엔티티 조회
        Child child = childRepository.findByIdAndGuardianId(childId, guardianId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHILD_NOT_FOUND));

        // 관심분야 조회
        String[] interests = child.getInterest();
        long behaviorAggregationStartedAt = System.nanoTime();
        List<AiReadingBehavior> readingBehaviors = recommendationBehaviorService
                .getReadingBehaviors(childId, languageCode);
        long behaviorAggregationMs = elapsedMillis(behaviorAggregationStartedAt);

        // 전체 추천 결과 조회
        // 첫 호출: FastAPI 호출
        // 이후 호출: 캐시에서 호출
        boolean cacheHit = hasRecommendationCache(childId, languageCode);
        long aiOrCacheStartedAt = System.nanoTime();
        List<AiRecommendedStory> recommendedStories =
                aiRecommendationClient.getRecommendations(
                        childId,
                        interests,
                        languageCode,
                        readingBehaviors
                );
        long aiOrCacheMs = elapsedMillis(aiOrCacheStartedAt);
        long persistenceStartedAt = System.nanoTime();

        // page, size에 맞게 자르기
        int start = (int) pageable.getOffset();
        int end = Math.min(
                start + pageable.getPageSize(),
                recommendedStories.size()
        );

        List<AiRecommendedStory> content =
                start >= recommendedStories.size()
                        ? List.of()
                        : recommendedStories.subList(start, end);

        Page<AiRecommendedStory> storyPage =
                new PageImpl<>(
                        content,
                        pageable,
                        recommendedStories.size()
                );

        // 응답 DTO 반환
//        List<StoryRecommendationResponse.StorySummary> stories =
//                storyPage.getContent().stream()
//                        .map(story -> new StoryRecommendationResponse.StorySummary(
//                                story.originalStoryId(),
//                                story.title(),
//                                story.tags()
//                        ))
//                        .toList();
        // 대표 이미지 key 일괄 조회 (originalStoryId -> cover key)
        List<Integer> storyIds = storyPage.getContent().stream()
                .map(AiRecommendedStory::originalStoryId)
                .toList();

        Map<Integer, OriginalStory> originalStories = originalStoryRepository.findAllById(storyIds)
                .stream()
                .collect(Collectors.toMap(OriginalStory::getId, story -> story));

        if (originalStories.size() != storyIds.stream().distinct().count()) {
            throw new BusinessException(ErrorCode.AI_RECOMMENDATION_FAILED);
        }

        Map<Integer, String> coverKeys = originalStories.values().stream()
                .filter(os -> os.getCoverImageUrl() != null)
                .collect(Collectors.toMap(
                        OriginalStory::getId,
                        OriginalStory::getCoverImageUrl
                ));

        Recommendation recommendation = recommendationRepository.save(new Recommendation(
                child,
                languageCode,
                "2.0.0",
                1L,
                "REQUEST",
                page,
                size,
                interests
        ));

        List<RecommendationItem> recommendationItems = recommendationItemRepository.saveAll(
                IntStream.range(0, storyPage.getContent().size())
                        .mapToObj(index -> {
                            AiRecommendedStory story = storyPage.getContent().get(index);
                            return new RecommendationItem(
                                    recommendation,
                                    originalStories.get(story.originalStoryId()),
                                    start + index + 1,
                                    story.score(),
                                    story.interestScore(),
                                    story.behaviorScore(),
                                    story.behaviorApplied()
                            );
                        })
                        .toList()
        );

        // 응답 DTO 반환
        List<StoryRecommendationResponse.StorySummary> stories =
                IntStream.range(0, storyPage.getContent().size())
                        .mapToObj(index -> {
                            AiRecommendedStory story = storyPage.getContent().get(index);
                            RecommendationItem item = recommendationItems.get(index);
                            return new StoryRecommendationResponse.StorySummary(
                                    item.getId(),
                                    story.originalStoryId(),
                                    item.getRank(),
                                    story.title(),
                                    story.tags(),
                                    generateUrl(coverKeys.get(story.originalStoryId()))
                            );
                        })
                        .toList();

        StoryRecommendationResponse.PageInfo pageInfo =
                new StoryRecommendationResponse.PageInfo(
                        storyPage.getNumber(),
                        storyPage.getSize(),
                        storyPage.getTotalPages(),
                        storyPage.getTotalElements(),
                        storyPage.hasNext(),
                        storyPage.hasPrevious()
                );

        StoryRecommendationResponse response = new StoryRecommendationResponse(
                recommendation.getId(),
                stories,
                pageInfo
        );
        long persistenceMs = elapsedMillis(persistenceStartedAt);
        long totalMs = elapsedMillis(totalStartedAt);

        recommendationPerformanceLogRepository.save(new RecommendationPerformanceLog(
                recommendation,
                cacheHit,
                behaviorAggregationMs,
                aiOrCacheMs,
                persistenceMs,
                totalMs
        ));
        log.info(
                "recommendation_timing recommendationId={} childId={} languageCode={} "
                        + "cacheHit={} behaviorAggregationMs={} aiOrCacheMs={} "
                        + "persistenceMs={} totalMs={} resultCount={}",
                recommendation.getId(),
                childId,
                languageCode,
                cacheHit,
                behaviorAggregationMs,
                aiOrCacheMs,
                persistenceMs,
                totalMs,
                stories.size()
        );
        return response;
//
//        List<StoryRecommendationResponse.StorySummary> stories =
//                storyPage.getContent().stream()
//                        .map(story -> new StoryRecommendationResponse.StorySummary(
//                                story.getId(),
//                                story.getTitle()
//                        ))
//                        .toList();
//
//        StoryRecommendationResponse.PageInfo pageInfo =
//                new StoryRecommendationResponse.PageInfo(
//                        storyPage.getNumber(),
//                        storyPage.getSize(),
//                        storyPage.getTotalPages(),
//                        storyPage.getTotalElements(),
//                        storyPage.hasNext(),
//                        storyPage.hasPrevious()
//                );
//
//        return new StoryRecommendationResponse(
//                stories,
//                pageInfo
//        );
    }

    @Override
    public StoryDetailResponse getStoryDetail(Integer originalStoryId, Integer level) {


        if (level < 1 || level > 3) {
            throw new BusinessException(ErrorCode.INVALID_STORY_LEVEL);
        }

        // 1. OriginalStory 조회
        OriginalStory originalStory = originalStoryRepository.findById(originalStoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.STORY_NOT_FOUND));

        String generatorType;
        String version;

        if (originalStory.getLanguageCode().equals("ko")) {
            generatorType = koGeneratorType;
            version = koVersion;
        } else {
            generatorType = enGeneratorType;
            version = enVersion;
        }

        // 2. StoryLevel 조회
        StoryLevel storyLevel = storyLevelRepository
                .findByOriginalStoryIdAndLevelAndGeneratorTypeAndVersion(
                        originalStoryId,
                        level,
                        generatorType,
                        version
                )
                .orElseThrow(() -> new BusinessException(ErrorCode.STORY_LEVEL_NOT_FOUND));

        // 3. StoryPart 조회
        List<StoryPartResponse> parts = storyPartRepository
                .findByStoryLevelIdOrderByOrderNumAsc(storyLevel.getId()) // 해당 레벨의 문단 정보 가져오기
                .stream()// 가져온 문단 리스트들을 하나씩 처리
                .map(part -> toStoryPartResponse(storyLevel.getId(), part))
                .toList(); // 변환된 결과들을 다시 리스트로

        return new StoryDetailResponse(
                originalStory.getId(),
                storyLevel.getId(),
                originalStory.getTitle(),
                storyLevel.getLevel(),
                parts
        );
    }

    // StoryPart 객체 하나를 StoryPartResponse 객체 하나로 변환
    private StoryPartResponse toStoryPartResponse(
            Integer storyLevelId,
            StoryPart part
    ) {
        List<StoryPageResponse> pages =
                storyPageRepository
                        .findByStoryPartIdOrderByPageNumAsc(
                                part.getId()
                        )
                        .stream()
                        .map(page ->
                                toPageResponse(
                                        storyLevelId,
                                        page
                                )
                        )
                        .toList();

        return new StoryPartResponse(
                part.getType(),
                part.getOrderNum(),
                pages
        );
    }

    // 하나의 StoryPage 객체를 StoryPageResponse로 변환
    private StoryPageResponse toPageResponse(
            Integer storyLevelId,
            StoryPage page
    ) {
        List<StorySentenceResponse> sentences =
                storySentenceRepository
                        .findByStoryLevelIdAndSentenceIdxBetweenOrderBySentenceIdxAsc(
                                storyLevelId,
                                page.getStartSentenceIdx(),
                                page.getEndSentenceIdx()
                        )
                        .stream()
                        .map(sentence ->
                                new StorySentenceResponse(
                                        sentence.getSentenceIdx(),
                                        sentence.getContent()
                                )
                        )
                        .toList();

        return new StoryPageResponse(
                page.getId(),
                page.getPageNum(),
                page.getImageKey(),
                sentences
        );
    }

    private String generateUrl(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return null;
        }
        return fileUrlProvider.generateUrl(objectKey);
    }

    private boolean hasRecommendationCache(Integer childId, String languageCode) {
        Cache cache = cacheManager.getCache("storyRecommendations");
        return cache != null && cache.get(childId + ":" + languageCode) != null;
    }

    private long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}