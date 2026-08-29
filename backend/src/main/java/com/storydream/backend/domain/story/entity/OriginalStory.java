package com.storydream.backend.domain.story.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "original_story")
public class OriginalStory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "content_url", nullable = false)
    private String contentUrl;

    @Column(name = "language_code", nullable = false, length = 20)
    private String languageCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "cover_image_url", columnDefinition = "TEXT")
    private String coverImageUrl;
}