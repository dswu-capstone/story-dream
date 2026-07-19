package com.storydream.backend.domain.quiz.repository;

import com.storydream.backend.domain.quiz.entity.QuizResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface QuizResultRepository extends JpaRepository<QuizResult, Integer> {

    /**
     * 리포트 집계용. quiz를 함께 가져와 part_type별로 묶는다.
     * 같은 퀴즈를 두 번 제출한 경우를 대비해 id 오름차순(= 제출 순서)으로 반환하고,
     * 서비스에서 quizId 기준 '마지막 제출'만 인정한다.
     */
    @Query("""
            select qr
            from QuizResult qr
            join fetch qr.quiz q
            where qr.readingHistory.id = :readingHistoryId
            order by qr.id asc
            """)
    List<QuizResult> findAllWithQuizByReadingHistoryId(@Param("readingHistoryId") Integer readingHistoryId);
}