package com.storydream.backend.domain.story.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "story_level",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_story_level_original_generator_version_level",
                        columnNames = {"original_story_id", "generator_type", "version", "level"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class StoryLevel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY) // original_story : story_level = 1 : N
                                        // LAZY: 연관된 데이터를 미리 조회하지 않고, 실제 사용할 때 조회 -> 읽기 성능 저하 방지
    @JoinColumn(name = "original_story_id", nullable = false)
    private OriginalStory originalStory;

    @Column(name = "generator_type", nullable = false, length = 30)
    private String generatorType;

    @Column(nullable = false, length = 30)
    private String version;

    @Column(nullable = false)
    private Integer level;

    @Column(name = "content_url", nullable = false, columnDefinition = "TEXT")
    private String contentUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}