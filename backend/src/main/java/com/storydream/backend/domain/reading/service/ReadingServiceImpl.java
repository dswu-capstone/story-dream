package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.reading.dto.NextPartRequest;
import com.storydream.backend.domain.reading.dto.NextPartResponse;
import com.storydream.backend.domain.reading.dto.ReadingStartRequest;
import com.storydream.backend.domain.reading.dto.ReadingStartResponse;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.story.dto.StoryDetailResponse;
import com.storydream.backend.domain.story.dto.StoryPartResponse;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.domain.story.repository.OriginalStoryRepository;
import com.storydream.backend.domain.story.service.StoryService;
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
    private final ReadingLogRepository readingLogRepository;

    private final StoryService storyService;

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

        Integer defaultLevel = child.getDefaultLevel();

        ReadingLog readingLog = ReadingLog.builder()
                .readingHistory(readingHistory)
                .partType("서론")
                .level(defaultLevel)
                .build();

        ReadingLog readinglog = readingLogRepository.save(readingLog);

        return new ReadingStartResponse(savedReadingHistory.getId());
    }

    @Override
    @Transactional
    public void endReading(
            Integer guardianId,
            Integer readingHistoryId
    ) {
        ReadingHistory readingHistory = readingHistoryRepository.findById(readingHistoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND));

        if (!readingHistory.getChild().getGuardian().getId().equals(guardianId)) {
            throw new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND);
        }

        readingHistory.end();
    }

    @Override
    @Transactional
    public NextPartResponse startNextPart(
            Integer guardianId,
            Integer readingHistoryId,
            NextPartRequest request
    ) {
        ReadingHistory readingHistory = readingHistoryRepository
                .findByIdAndChildGuardianId(readingHistoryId, guardianId)
                .orElseThrow(() ->
                        new BusinessException(
                                ErrorCode.READING_HISTORY_NOT_FOUND
                        )
                );



        // 현재 진행 중인 파트 조회
        ReadingLog currentLog = readingLogRepository
                .findTopByReadingHistoryIdOrderByIdDesc(
                        readingHistoryId
                )
                .orElseThrow(() ->
                        new BusinessException(
                                ErrorCode.READING_LOG_NOT_FOUND
                        )
                );

        String currentPartType = currentLog.getPartType();
        String nextPartType;

        // 현재 파트를 기준으로 다음 파트 결정
        if ("서론".equals(currentPartType)) {
            nextPartType = "본론";
        } else if ("본론".equals(currentPartType)) {
            nextPartType = "결론";
        } else {
            throw new BusinessException(
                    ErrorCode.INVALID_NEXT_PART
            );
        }

        Integer currentLevel = currentLog.getLevel();
        Integer selectedLevel = request.selectedLevel();

        boolean levelChanged =
                !selectedLevel.equals(currentLevel);

        /*
         * 레벨이 변경된 경우에만
         * 변경된 레벨의 전체 동화 내용을 다시 조회한다.
         *
         * 레벨이 유지되면 프론트가 기존에 받은 동화를 사용하므로 null.
         */
        StoryDetailResponse storyDetail = null;

        if (levelChanged) {
            Integer originalStoryId = readingHistory
                    .getOriginalStory()
                    .getId();

            storyDetail = storyService.getStoryDetail(
                    originalStoryId,
                    selectedLevel
            );
        }

        // 다음 파트와 실제 적용 레벨 저장
        ReadingLog nextLog = ReadingLog.builder()
                .readingHistory(readingHistory)
                .partType(nextPartType)
                .level(selectedLevel)
                .build();

        readingLogRepository.save(nextLog);

        return new NextPartResponse(
                nextPartType,
                selectedLevel,
                levelChanged,
                storyDetail
        );
    }
}