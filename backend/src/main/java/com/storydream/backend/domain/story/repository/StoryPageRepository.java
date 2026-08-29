package com.storydream.backend.domain.story.repository;

import com.storydream.backend.domain.story.entity.StoryPage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoryPageRepository
        extends JpaRepository<StoryPage, Integer> {

    List<StoryPage> findByStoryPartIdOrderByPageNumAsc(
            Integer storyPartId
    );

    List<StoryPage> findByStoryPart_StoryLevel_IdAndStoryPart_TypeOrderByPageNumAsc(
            Integer storyLevelId,
            String type
    );
}