package com.storydream.backend.domain.quiz.repository;

import com.storydream.backend.domain.quiz.entity.QuizResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuizResultRepository extends JpaRepository<QuizResult, Integer> {
}