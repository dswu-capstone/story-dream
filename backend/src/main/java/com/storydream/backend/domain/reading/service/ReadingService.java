package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.reading.dto.NextPartRequest;
import com.storydream.backend.domain.reading.dto.NextPartResponse;
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

    NextPartResponse startNextPart(
            Integer guardianId,
            Integer readingHistoryId,
            NextPartRequest request
    );


}