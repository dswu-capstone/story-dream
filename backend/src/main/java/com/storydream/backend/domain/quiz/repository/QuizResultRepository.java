package com.storydream.backend.domain.quiz.repository;

import com.storydream.backend.domain.quiz.entity.QuizResult;
import org.springframework.data.jpa.repository.JpaRepository;
import com.storydream.backend.domain.report.repository.projection.PartQuizStat;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface QuizResultRepository extends JpaRepository<QuizResult, Integer> {

    @Query("""
        SELECT q.partType AS partType,
               COUNT(qr.id) AS totalCount,
               SUM(CASE WHEN qr.isCorrect = true THEN 1L ELSE 0L END) AS correctCount
          FROM QuizResult qr
          JOIN qr.quiz q
         WHERE qr.readingHistory.id = :historyId
         GROUP BY q.partType
        """)
    List<PartQuizStat> findPartStatsByReadingHistoryId(@Param("historyId") Integer historyId);
}