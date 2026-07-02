package com.storydream.backend.domain.story.service;

import com.storydream.backend.domain.story.dto.StoryRecommendationResponse;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.domain.story.repository.OriginalStoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StoryServiceImpl implements StoryService {

    private final OriginalStoryRepository originalStoryRepository;

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
}