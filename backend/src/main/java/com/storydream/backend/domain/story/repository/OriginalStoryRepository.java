package com.storydream.backend.domain.story.repository;

import com.storydream.backend.domain.story.entity.OriginalStory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OriginalStoryRepository extends JpaRepository<OriginalStory, Integer> {
    Page<OriginalStory> findByLanguageCode(
            String languageCode,
            Pageable pageable
    );
}
