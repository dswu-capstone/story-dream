package com.storydream.backend.domain.story.service;

import com.storydream.backend.domain.story.dto.StoryDetailResponse;
import com.storydream.backend.domain.story.dto.StoryPartResponse;
import com.storydream.backend.domain.story.dto.StoryRecommendationResponse;
import com.storydream.backend.domain.story.dto.StorySentenceResponse;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.domain.story.entity.StoryLevel;
import com.storydream.backend.domain.story.entity.StoryPart;
import com.storydream.backend.domain.story.repository.OriginalStoryRepository;
import com.storydream.backend.domain.story.repository.StoryLevelRepository;
import com.storydream.backend.domain.story.repository.StoryPartRepository;
import com.storydream.backend.domain.story.repository.StorySentenceRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
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

    @Value("${story.dataset.generator-type}")
    private String generatorType;

    @Value("${story.dataset.version}")
    private String version;

    @Override
    public StoryRecommendationResponse getRecommendations(
            Integer childId,
            String languageCode,
            Integer page,
            Integer size
    ) {

        Pageable pageable = PageRequest.of(page, size);

        Page<OriginalStory> storyPage =
                originalStoryRepository.findByLanguageCode(languageCode, pageable);

        List<StoryRecommendationResponse.StorySummary> stories =
                storyPage.getContent().stream()
                        .map(story -> new StoryRecommendationResponse.StorySummary(
                                story.getId(),
                                story.getTitle(),
                                story.getLanguageCode()
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
    }

    @Override
    public StoryDetailResponse getStoryDetail(Integer originalStoryId, Integer level) {
        if (level < 1 || level > 3) {
            throw new BusinessException(ErrorCode.INVALID_STORY_LEVEL);
        }

        // 1. OriginalStory 조회
        OriginalStory originalStory = originalStoryRepository.findById(originalStoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.STORY_NOT_FOUND));

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
                .findByStoryLevelIdOrderByOrderNumAsc(storyLevel.getId()) // 현재 동화 레벨에 해당하는 문단들 가져오기
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

    private StoryPartResponse toStoryPartResponse(
            Integer storyLevelId,
            StoryPart part
    ) {
        List<StorySentenceResponse> sentences = storySentenceRepository
                .findByStoryLevelIdAndSentenceIdxBetweenOrderBySentenceIdxAsc(
                        storyLevelId,
                        part.getStartSentenceIdx(),
                        part.getEndSentenceIdx()
                )
                .stream()
                .map(sentence -> new StorySentenceResponse(
                        sentence.getSentenceIdx(),
                        sentence.getContent()
                ))
                .toList();

        return new StoryPartResponse(
                part.getType(),
                part.getOrderNum(),
                sentences
        );
    }
}