// StorySentence.java
package com.storydream.backend.domain.story.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "story_sentence",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_story_sentence_level_idx",
                        columnNames = {"story_level_id", "sentence_idx"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class StorySentence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "story_level_id", nullable = false)
    private StoryLevel storyLevel;

    @Column(name = "sentence_idx", nullable = false)
    private Integer sentenceIdx;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}