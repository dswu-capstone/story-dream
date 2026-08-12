package com.storydream.backend.domain.reading.dto;

import java.util.List;

public record ReadingStartResponse(
        Integer readingHistoryId,
        String partType,
        Integer partOrderNum,
        Integer level,
        List<PageResponse> pages
) {
}