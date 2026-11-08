package com.storydream.backend.domain.story.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "story_metadata", schema = "public")
public class StoryMetadata {
    @Id
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "original_story_id", nullable = false, unique = true)
    private OriginalStory originalStory;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_story_level_id", nullable = false)
    private StoryLevel sourceStoryLevel;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private String[] tags;

    @Column(name = "length_category", nullable = false, length = 10)
    private String lengthCategory;

    @Column(nullable = false, columnDefinition = "text")
    private String theme;

    @Column(name = "text_source", nullable = false, length = 100)
    private String textSource;

    @Column(name = "generation_model", nullable = false, length = 100)
    private String generationModel;

    @Column(name = "generated_at", nullable = false, columnDefinition = "timestamptz")
    private OffsetDateTime generatedAt;

    // Database-owned timestamps; a DEFAULT alone does not update updated_at on UPDATE.
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false,
            columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false,
            columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;
}
