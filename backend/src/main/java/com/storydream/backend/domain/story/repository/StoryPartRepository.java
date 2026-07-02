package com.storydream.backend.domain.story.repository;

import com.storydream.backend.domain.story.entity.StoryPart;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoryPartRepository extends JpaRepository<StoryPart, Integer> {

    List<StoryPart> findByStoryLevelIdOrderByOrderNumAsc(Integer storyLevelId);
}