package com.storydream.backend.domain.story.repository;

import com.storydream.backend.domain.story.entity.OriginalStory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OriginalStoryRepository extends JpaRepository<OriginalStory, Integer> {
    @Query("""
            SELECT os
            FROM OriginalStory os
            WHERE os.languageCode = :languageCode
                AND EXISTS (
                    SELECT 1
                    FROM StoryLevel sl
                    WHERE sl.originalStory.id = os.id
                        AND sl.generatorType = :generatorType
                        AND sl.version = :version
                )
            """)
    Page<OriginalStory> findActiveStories(
            @Param("languageCode") String languageCode,
            @Param("generatorType") String generatorType,
            @Param("version") String version,
            Pageable pageable
    );


}
