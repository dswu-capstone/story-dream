package com.storydream.backend.domain.story.repository;

import com.storydream.backend.domain.story.entity.StorySentence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StorySentenceRepository extends JpaRepository<StorySentence, Integer> {

    List<StorySentence> findByStoryLevelIdAndSentenceIdxBetweenOrderBySentenceIdxAsc(
            Integer storyLevelId,
            Integer startSentenceIdx,
            Integer endSentenceIdx
    );
}