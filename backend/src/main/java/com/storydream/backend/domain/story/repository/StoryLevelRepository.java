package com.storydream.backend.domain.story.repository;

import com.storydream.backend.domain.story.entity.StoryLevel;
import com.storydream.backend.domain.story.entity.StorySentence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoryLevelRepository extends JpaRepository<StoryLevel, Integer> {
    Optional<StoryLevel> findByOriginalStoryIdAndLevelAndGeneratorTypeAndVersion(
            Integer originalStoryId,
            Integer level,
            String generatorType,
            String version
    );

    List<StorySentence> findByStoryLevelIdAndSentenceIdxBetweenOrderBySentenceIdxAsc(
            Integer storyLevelId,
            Integer startSentenceIdx,
            Integer endSentenceIdx
    );
}
