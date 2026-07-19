package com.storydream.backend.domain.report.repository;

import com.storydream.backend.domain.reading.entity.ReadingStatus;
import com.storydream.backend.domain.report.entity.AiReadingReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AiReadingReportRepository extends JpaRepository<AiReadingReport, Integer> {

    boolean existsByReadingHistoryId(Integer readingHistoryId);

    /** 화면3 : 리포트 + 문단 + 동화 + 아동(보호자 확인용) 한 번에 */
    @Query("""
            select distinct r
            from AiReadingReport r
            left join fetch r.parts
            join fetch r.readingHistory rh
            join fetch rh.originalStory
            join fetch rh.child c
            join fetch c.guardian
            where rh.id = :readingHistoryId
            """)
    Optional<AiReadingReport> findDetailByReadingHistoryId(
            @Param("readingHistoryId") Integer readingHistoryId
    );

    /**
     * 화면2 : 기간 내 완료된 독서의 리포트 목록.
     * 주차별 평균 / 전체 평균 / 독서 이력 목록을 모두 이 결과로 계산한다.
     * (한 아이가 한 달에 읽는 동화 수는 많아야 수십 권이라 애플리케이션 집계로 충분하다)
     */
    @Query("""
            select r
            from AiReadingReport r
            join fetch r.readingHistory rh
            join fetch rh.originalStory
            where rh.child.id = :childId
              and rh.status = :status
              and rh.endedAt >= :startAt
              and rh.endedAt < :endAt
            order by rh.endedAt asc
            """)
    List<AiReadingReport> findAllInPeriod(
            @Param("childId") Integer childId,
            @Param("status") ReadingStatus status,
            @Param("startAt") LocalDateTime startAt,
            @Param("endAt") LocalDateTime endAt
    );
}