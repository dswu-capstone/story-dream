package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.reading.dto.ReadingStartRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartResponse;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.domain.story.repository.OriginalStoryRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReadingServiceImpl implements ReadingService {

    private final ReadingHistoryRepository readingHistoryRepository;
    private final ChildRepository childRepository;
    private final OriginalStoryRepository originalStoryRepository;

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
}