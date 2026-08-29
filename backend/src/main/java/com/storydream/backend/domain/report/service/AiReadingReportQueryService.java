package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.report.dto.ReportDetailResponse;
import com.storydream.backend.domain.report.dto.ReportSummaryResponse;
import com.storydream.backend.domain.report.entity.AiReadingReport;
import com.storydream.backend.domain.report.exception.ReportNotFoundException;
import com.storydream.backend.domain.report.repository.AiReadingReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiReadingReportQueryService {

    private final AiReadingReportRepository reportRepository;
    private final ChildRepository childRepository;

    public Page<ReportSummaryResponse> getReports(Integer guardianId, Integer childId,
                                                  LocalDate from, LocalDate to, Pageable pageable) {
        verifyChildOwnership(guardianId, childId);

        return reportRepository.findCompletedByChildIdAndPeriod(
                        childId, from.atStartOfDay(), to.plusDays(1).atStartOfDay(), pageable)
                .map(ReportSummaryResponse::from);
    }

    public ReportDetailResponse getReportDetail(Integer guardianId, Integer reportId) {
        AiReadingReport report = reportRepository.findWithDetailById(reportId)
                .orElseThrow(() -> new ReportNotFoundException(reportId));

        Integer ownerId = report.getChild().getGuardian().getId();
        if (!ownerId.equals(guardianId)) {
            throw new SecurityException("해당 아이의 리포트에 접근할 수 없습니다.");
        }

        return ReportDetailResponse.from(report);
    }

    private void verifyChildOwnership(Integer guardianId, Integer childId) {
        Child child = childRepository.findById(childId)
                .orElseThrow(() -> new IllegalArgumentException("아이 정보가 없습니다. id=" + childId));
        if (!child.getGuardian().getId().equals(guardianId)) {
            throw new SecurityException("해당 아이의 리포트에 접근할 수 없습니다.");
        }
    }
}
