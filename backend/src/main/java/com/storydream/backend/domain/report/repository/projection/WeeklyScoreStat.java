package com.storydream.backend.domain.report.repository.projection;

import java.math.BigDecimal;

public interface WeeklyScoreStat {
    Integer getBucketIndex();
    Long getReadingCount();
    BigDecimal getAvgScore();
}
