package com.storydream.backend.domain.report.repository;

import com.storydream.backend.domain.report.entity.ChildPeriodReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface ChildPeriodReportRepository extends JpaRepository<ChildPeriodReport, Integer> {

    Optional<ChildPeriodReport> findByChildIdAndPeriodStartAndPeriodEnd(
            Integer childId,
            LocalDate periodStart,
            LocalDate periodEnd
    );
}