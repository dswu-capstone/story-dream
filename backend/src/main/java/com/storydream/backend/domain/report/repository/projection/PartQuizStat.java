package com.storydream.backend.domain.report.repository.projection;

public interface PartQuizStat {
    String getPartType();
    Long getTotalCount();
    Long getCorrectCount();
}
