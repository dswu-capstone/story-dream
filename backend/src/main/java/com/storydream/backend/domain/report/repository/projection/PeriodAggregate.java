package com.storydream.backend.domain.report.repository.projection;

import java.math.BigDecimal;

public interface PeriodAggregate {
    Long getReportCount();
    BigDecimal getAvgScore();
    BigDecimal getAvgFocusRate();
}
