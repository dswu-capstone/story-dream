package com.storydream.backend.domain.report.dto;

import java.util.List;

public record ReadingHistoryListResponse(
        List<ReadingHistoryItemResponse> histories
) {
}