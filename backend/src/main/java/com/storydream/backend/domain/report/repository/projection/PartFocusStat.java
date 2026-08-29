package com.storydream.backend.domain.report.repository.projection;

public interface PartFocusStat {
    String getPartType();
    Long getDistractionCount();
    Long getDistractionSec();
}
