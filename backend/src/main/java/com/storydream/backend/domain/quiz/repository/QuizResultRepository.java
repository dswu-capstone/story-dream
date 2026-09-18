package com.storydream.backend.domain.quiz.repository;

import com.storydream.backend.domain.quiz.entity.QuizResult;
import org.springframework.data.jpa.repository.JpaRepository;
import com.storydream.backend.domain.report.repository.projection.PartQuizStat;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface QuizResultRepository extends JpaRepository<QuizResult, Integer> {

    @Query("""
        SELECT DISTINCT qr.quiz.id
          FROM QuizResult qr
         WHERE qr.readingHistory.id = :historyId
           AND qr.quiz.id IN :quizIds
        """)
    List<Integer> findSubmittedQuizIds(
            @Param("historyId") Integer historyId,
            @Param("quizIds") List<Integer> quizIds
    );

    Optional<QuizResult> findByReadingHistoryIdAndQuizId(
            Integer readingHistoryId,
            Integer quizId
    );

    @Query("""
        SELECT COUNT(qr.id)
          FROM QuizResult qr
          JOIN qr.quiz q
         WHERE qr.readingHistory.id = :historyId
           AND q.partType = :partType
           AND qr.isCorrect = true
        """)
    long countCorrectByReadingHistoryIdAndPartType(
            @Param("historyId") Integer historyId,
            @Param("partType") String partType
    );

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
