package com.storydream.backend.domain.story.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.story.dto.*;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.domain.story.entity.StoryLevel;
import com.storydream.backend.domain.story.entity.StoryPage;
import com.storydream.backend.domain.story.entity.StoryPart;
import com.storydream.backend.domain.story.repository.*;
import com.storydream.backend.global.client.AiRecommendationClient;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StoryServiceImpl implements StoryService {

    private final OriginalStoryRepository originalStoryRepository;
    private final StoryLevelRepository storyLevelRepository;
    private final StoryPartRepository storyPartRepository;
    private final StorySentenceRepository storySentenceRepository;
    private final StoryPageRepository storyPageRepository;
    private final ChildRepository childRepository;

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
    public StoryRecommendationResponse getRecommendations(
            Integer childId,
            String languageCode,
            Integer page,
            Integer size
    ) {
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
        Child child = childRepository.findById(childId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHILD_NOT_FOUND));

        // 관심분야 조회
        String[] interests = child.getInterest();

        // 전체 추천 결과 조회
        // 첫 호출: FastAPI 호출
        // 이후 호출: 캐시에서 호출
        List<AiRecommendedStory> recommendedStories =
                aiRecommendationClient.getRecommendations(
                        childId,
                        interests,
                        languageCode
                );

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
        List<StoryRecommendationResponse.StorySummary> stories =
                storyPage.getContent().stream()
                        .map(story -> new StoryRecommendationResponse.StorySummary(
                                story.originalStoryId(),
                                story.title(),
                                story.tags()
                        ))
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

        return new StoryRecommendationResponse(
                stories,
                pageInfo
        );
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
}
