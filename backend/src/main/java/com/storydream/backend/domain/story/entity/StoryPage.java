package com.storydream.backend.domain.story.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "story_page",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_story_page_part_num",
                        columnNames = {"story_part_id", "page_num"}
                )
        }
)

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class StoryPage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "story_part_id", nullable = false)
    private StoryPart storyPart;

    @Column(name = "page_num", nullable = false)
    private Integer pageNum;

    @Column(name = "start_sentence_idx", nullable = false)
    private Integer startSentenceIdx;

    @Column(name = "end_sentence_idx", nullable = false)
    private Integer endSentenceIdx;

    @Column(name = "audio_key")
    private String audioKey;

    @Column(name = "image_key")
    private String imageKey;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

}
