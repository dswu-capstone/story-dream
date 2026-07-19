package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.reading.dto.ReadingStartRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartResponse;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.domain.story.repository.OriginalStoryRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.reading.dto.ReadingLogRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartResponse;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.entity.ReadingStatus;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.report.entity.PartType;
import com.storydream.backend.domain.report.event.ReadingCompletedEvent;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.domain.story.repository.OriginalStoryRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReadingServiceImpl implements ReadingService {

    private final ReadingHistoryRepository readingHistoryRepository;
    private final ReadingLogRepository readingLogRepository;
    private final ChildRepository childRepository;
    private final OriginalStoryRepository originalStoryRepository;

    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public ReadingStartResponse startReading(
            Integer guardianId,
            ReadingStartRequest request
    ) {
        Child child = childRepository.findByIdAndGuardianId(
                        request.childId(),
                        guardianId
                )
                .orElseThrow(() -> new BusinessException(ErrorCode.CHILD_NOT_FOUND));

        OriginalStory originalStory = originalStoryRepository.findById(request.originalStoryId())
                .orElseThrow(() -> new BusinessException(ErrorCode.STORY_NOT_FOUND));

        ReadingHistory readingHistory = ReadingHistory.builder()
                .child(child)
                .originalStory(originalStory)
                .build();

        ReadingHistory savedReadingHistory = readingHistoryRepository.save(readingHistory);

        return new ReadingStartResponse(savedReadingHistory.getId());
    }

    @Override
    @Transactional
    public void endReading(
            Integer guardianId,
            Integer readingHistoryId
    ) {
        ReadingHistory readingHistory = readingHistoryRepository.findById(readingHistoryId);
//                .orElseThrow(() -> new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND));

//        if (!readingHistory.getChild().getGuardian().getId().equals(guardianId)) {
//            throw new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND);
//        }
        if (readingHistory.getStatus() == ReadingStatus.COMPLETED) {
            return;
        }

        readingHistory.end();

        eventPublisher.publishEvent(new ReadingCompletedEvent(readingHistory.getId()));
    }

    @Override
    @Transactional
    public void saveReadingLog(
            Integer guardianId,
            Integer readingHistoryId,
            ReadingLogRequest request
    ) {
        ReadingHistory readingHistory = findOwnedHistory(guardianId, readingHistoryId);

        // 잘못된 문단 이름이면 여기서 걸러진다 (서론/본론/결론)
        PartType partType = PartType.from(request.partType());

        ReadingLog readingLog = ReadingLog.builder()
                .readingHistory(readingHistory)
                .partType(partType.getLabel())
                .level(request.level())
                .build();

        readingLogRepository.save(readingLog);
    }

    private ReadingHistory findOwnedHistory(Integer guardianId, Integer readingHistoryId) {
        ReadingHistory readingHistory = readingHistoryRepository.findById(readingHistoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND));

        if (!readingHistory.getChild().getGuardian().getId().equals(guardianId)) {
            throw new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND);
        }

        return readingHistory;
    }
}