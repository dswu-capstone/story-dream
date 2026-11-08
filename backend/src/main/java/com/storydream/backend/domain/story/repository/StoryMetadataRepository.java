package com.storydream.backend.domain.story.repository;

import com.storydream.backend.domain.story.entity.StoryMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface StoryMetadataRepository extends JpaRepository<StoryMetadata, Integer> {
    List<StoryMetadata> findByOriginalStory_IdIn(Collection<Integer> originalStoryIds);
}