// StoryPart.java
package com.storydream.backend.domain.story.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "story_part",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_story_part_level_type",
                        columnNames = {"story_level_id", "type"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class StoryPart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "story_level_id", nullable = false)
    private StoryLevel storyLevel;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(name = "order_num", nullable = false)
    private Integer orderNum;

    @Column(name = "start_sentence_idx", nullable = false)
    private Integer startSentenceIdx;

    @Column(name = "end_sentence_idx", nullable = false)
    private Integer endSentenceIdx;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}