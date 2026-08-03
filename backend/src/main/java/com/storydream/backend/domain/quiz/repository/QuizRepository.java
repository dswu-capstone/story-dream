package com.storydream.backend.domain.quiz.repository;

import com.storydream.backend.domain.quiz.entity.Quiz;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuizRepository extends JpaRepository<Quiz, Integer> {

    List<Quiz> findByOriginalStoryIdAndPartTypeOrderByOrderNumAsc(
            Integer originalStoryId,
            String partType
    );

    boolean existsByOriginalStoryIdAndPartTypeAndOrderNumGreaterThan(
            Integer originalStoryId,
            String partType,
            Integer orderNum
    );
}