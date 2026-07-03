// entity/Quiz.java
package com.storydream.backend.domain.quiz.entity;

import com.storydream.backend.domain.story.entity.OriginalStory;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode; // 타입 명시(타입 인식 못함 방지)
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "quiz")
public class Quiz {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_story_id", nullable = false)
    private OriginalStory originalStory;

    @Column(name = "part_type", nullable = false, length = 20)
    private String partType;

    @Column(nullable = false)
    private String question;

    @Column(nullable = false, length = 20)
    private String type;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "VARCHAR(255)[]")
    private List<String> choices;

    @Column(nullable = false)
    private String answer;

    @Column(name = "order_num", nullable = false)
    private Integer orderNum;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}