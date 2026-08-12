package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.reading.dto.*;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.story.dto.StoryDetailResponse;
import com.storydream.backend.domain.story.dto.StoryPartResponse;
import com.storydream.backend.domain.story.entity.*;
import com.storydream.backend.domain.story.repository.*;
import com.storydream.backend.domain.story.service.StoryService;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReadingServiceImpl implements ReadingService {

    private final ReadingHistoryRepository readingHistoryRepository;
    private final ChildRepository childRepository;
    private final OriginalStoryRepository originalStoryRepository;
    private final ReadingLogRepository readingLogRepository;
    private final StoryLevelRepository storyLevelRepository;
    private final StoryPageRepository  storyPageRepository;
    private final StoryPartRepository storyPartRepository;
    private final StorySentenceRepository storySentenceRepository;

    private final StoryService storyService;

    @Value("${story.dataset.ko.generator-type}")
    private String koGeneratorType;

    @Value("${story.dataset.ko.version}")
    private String koVersion;

    @Value("${story.dataset.en.generator-type}")
    private String enGeneratorType;

    @Value("${story.dataset.en.version}")
    private String enVersion;


    @Override
    @Transactional
    public ReadingStartResponse startReading(
            Integer guardianId,
            ReadingStartRequest request
    ) {
        Child child = childRepository.findByIdAndGuardianId(
                        request.childId(), // 프론트가 보낸 childId
                        guardianId // 토큰에서 얻은 guardianId
                )
                .orElseThrow(() -> new BusinessException(ErrorCode.CHILD_NOT_FOUND));

        OriginalStory originalStory = originalStoryRepository.findById(request.originalStoryId())
                .orElseThrow(() -> new BusinessException(ErrorCode.STORY_NOT_FOUND));

        // readingHistory 생성 및 저장
        ReadingHistory readingHistory = ReadingHistory.builder()
                .child(child)
                .originalStory(originalStory)
                .build();

        ReadingHistory savedReadingHistory = readingHistoryRepository.save(readingHistory);

        // 디폴트 난이도 조회
        Integer defaultLevel = child.getDefaultLevel();

        // 동화 언어 조회 후 생성타입 & 버전 고정
        String generatorType;
        String version;

        if ("ko".equals(originalStory.getLanguageCode())) {
            generatorType = koGeneratorType;
            version = koVersion;
        } else if ("en".equals(originalStory.getLanguageCode())) {
            generatorType = enGeneratorType;
            version = enVersion;
        } else {
            throw new BusinessException(ErrorCode.INVALID_LANGUAGE);
        }

        // 해당 동화와 난이도의 StoryLevel 조회
        StoryLevel storyLevel = storyLevelRepository
                .findByOriginalStoryIdAndLevelAndGeneratorTypeAndVersion(
                        originalStory.getId(),
                        defaultLevel,
                        generatorType,
                        version
                )
                .orElseThrow(() ->
                        new BusinessException(ErrorCode.STORY_LEVEL_NOT_FOUND)
                );

        // 서론 파트 조회
        StoryPart storyPart = storyPartRepository
                .findByStoryLevelIdAndType(
                        storyLevel.getId(),
                        "서론"
                )
                .orElseThrow(() ->
                        new BusinessException(ErrorCode.STORY_PART_NOT_FOUND)
                );

        // readingLog 생성 및 저장
        ReadingLog readingLog = ReadingLog.builder()
                .readingHistory(readingHistory)
                .partType("서론")
                .level(defaultLevel)
                .build();

        ReadingLog readinglog = readingLogRepository.save(readingLog);

        // 서론 페이지 전체 조회
        List<StoryPage> pages = storyPageRepository
                .findByStoryPart_StoryLevel_IdAndStoryPart_TypeOrderByPageNumAsc(
                        storyLevel.getId(),
                        "서론"
                );

        // 페이지가 하나도 없는 경우
        if (pages.isEmpty()) {
            throw new BusinessException(ErrorCode.STORY_PAGE_NOT_FOUND);
        }

        // 서론 전체 문장 범위 확인
        Integer startSentenceIdx =
                pages.get(0).getStartSentenceIdx();

        Integer endSentenceIdx =
                pages.get(pages.size() - 1).getEndSentenceIdx();

        // 서론에 필요한 문장을 DB에서 한 번에 조회
        List<StorySentence> allSentences = storySentenceRepository
                .findByStoryLevelIdAndSentenceIdxBetweenOrderBySentenceIdxAsc(
                        storyLevel.getId(),
                        startSentenceIdx,
                        endSentenceIdx
                );

        // 페이지별로 문장을 매핑해서 PageResponse 생성
        List<PageResponse> pageResponses = pages.stream()
                .map(page -> {

                    List<SentenceResponse> sentenceResponses =
                            allSentences.stream()
                                    .filter(sentence ->
                                            sentence.getSentenceIdx()
                                                    >= page.getStartSentenceIdx()
                                                    &&
                                                    sentence.getSentenceIdx()
                                                            <= page.getEndSentenceIdx()
                                    )
                                    .map(sentence ->
                                            new SentenceResponse(
                                                    sentence.getSentenceIdx(),
                                                    sentence.getContent()
                                            )
                                    )
                                    .toList();
                    return new PageResponse(
                            page.getId(),
                            page.getPageNum(),
                            page.getImageUrl(),
                            sentenceResponses
                    );
                })
                .toList();

        // 최종 응답
        return new ReadingStartResponse(
                savedReadingHistory.getId(),
                storyPart.getType(),
                storyPart.getOrderNum(),
                pageResponses
        );
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