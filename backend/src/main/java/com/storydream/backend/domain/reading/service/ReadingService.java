package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.reading.dto.ReadingStartRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartResponse;

public interface ReadingService {

    ReadingStartResponse startReading(
            Integer guardianId,
            ReadingStartRequest request
    );
}