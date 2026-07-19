package com.storydream.backend.domain.report.event;

/** 독서가 COMPLETED 로 바뀔 때 발행 (ReadingServiceImpl.endReading) */
public record ReadingCompletedEvent(Integer readingHistoryId) {
}