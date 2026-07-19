package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.reading.dto.ReadingLogRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartResponse;

public interface ReadingService {

    ReadingStartResponse startReading(
            Integer guardianId,
            ReadingStartRequest request
    );

    void endReading(
            Integer guardianId,
            Integer readingHistoryId
    );

    /** 문단(서론/본론/결론)을 다 읽었을 때, 그 문단을 읽은 난이도를 기록한다. */
    void saveReadingLog(
            Integer guardianId,
            Integer readingHistoryId,
            ReadingLogRequest request
    );

}