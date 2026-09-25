package com.storydream.backend.domain.reading.repository;

import com.storydream.backend.domain.reading.entity.ReadingHistory;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ReadingHistoryRepository extends JpaRepository<ReadingHistory, Integer> {
    Optional<ReadingHistory> findByIdAndChildGuardianId(Integer readingHistoryId, Integer guardianId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rh FROM ReadingHistory rh WHERE rh.id = :historyId AND rh.child.guardian.id = :guardianId")
    Optional<ReadingHistory> findOwnedByIdForUpdate(
            @Param("historyId") Integer historyId,
            @Param("guardianId") Integer guardianId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rh FROM ReadingHistory rh WHERE rh.id = :readingHistoryId")
    Optional<ReadingHistory> findByIdForUpdate(
            @Param("readingHistoryId") Integer readingHistoryId
    );
}
