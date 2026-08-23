package com.storydream.backend.domain.report.exception;

public class ReportNotFoundException extends RuntimeException {
    public ReportNotFoundException(Integer reportId) {
        super("리포트를 찾을 수 없습니다. id=" + reportId);
    }
}
