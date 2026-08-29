package com.storydream.backend.domain.report.repository;

import com.storydream.backend.domain.report.entity.ChildPeriodSummary;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface ChildPeriodSummaryRepository extends JpaRepository<ChildPeriodSummary, Integer> {

    Optional<ChildPeriodSummary> findByChildIdAndPeriodStartAndPeriodEnd(
            Integer childId, LocalDate periodStart, LocalDate periodEnd);
}