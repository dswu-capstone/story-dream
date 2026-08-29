package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.reading.dto.*;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.story.entity.*;
import com.storydream.backend.domain.story.repository.*;
import com.storydream.backend.domain.story.service.StoryService;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import com.storydream.backend.global.storage.FileUrlProvider;
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

    private final FileUrlProvider fileUrlProvider;

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

        readingLogRepository.save(readingLog);

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

        List<PageResponse> pageResponses = createPageResponses(pages, allSentences);

        // 최종 응답
        return new ReadingStartResponse(
                savedReadingHistory.getId(),
                storyPart.getType(),
                storyPart.getOrderNum(),
                child.getDefaultLevel(),
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
        // 로그인한 보호자의 독서 기록인지 확인
        ReadingHistory readingHistory = readingHistoryRepository
                .findByIdAndChildGuardianId(
                        readingHistoryId,
                        guardianId
                )
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

        // 현재 파트를 기준으로 다음 파트 결정
        String currentPartType = currentLog.getPartType();
        String nextPartType;

        if ("서론".equals(currentPartType)) {
            nextPartType = "본론";
        } else if ("본론".equals(currentPartType)) {
            nextPartType = "결론";
        } else {
            throw new BusinessException(
                    ErrorCode.INVALID_NEXT_PART
            );
        }

        // 프론트에서 선택한 난이도
        Integer selectedLevel = request.selectedLevel();

        // 원본 동화 조회
        OriginalStory originalStory =
                readingHistory.getOriginalStory();

        // 동화 언어에 따라 generatorType / version 결정
        String generatorType;
        String version;

        if ("ko".equals(originalStory.getLanguageCode())) {
            generatorType = koGeneratorType;
            version = koVersion;
        } else if ("en".equals(originalStory.getLanguageCode())) {
            generatorType = enGeneratorType;
            version = enVersion;
        } else {
            throw new BusinessException(
                    ErrorCode.INVALID_LANGUAGE
            );
        }

        // 선택한 난이도의 StoryLevel 조회
        StoryLevel storyLevel = storyLevelRepository
                .findByOriginalStoryIdAndLevelAndGeneratorTypeAndVersion(
                        originalStory.getId(),
                        selectedLevel,
                        generatorType,
                        version
                )
                .orElseThrow(() ->
                        new BusinessException(
                                ErrorCode.STORY_LEVEL_NOT_FOUND
                        )
                );

        // 다음 StoryPart 조회
        StoryPart storyPart = storyPartRepository
                .findByStoryLevelIdAndType(
                        storyLevel.getId(),
                        nextPartType
                )
                .orElseThrow(() ->
                        new BusinessException(
                                ErrorCode.STORY_PART_NOT_FOUND
                        )
                );

        // 다음 파트 ReadingLog 저장
        ReadingLog nextLog = ReadingLog.builder()
                .readingHistory(readingHistory)
                .partType(nextPartType)
                .level(selectedLevel)
                .build();

        readingLogRepository.save(nextLog);

        // 다음 파트의 페이지 전체 조회
        List<StoryPage> pages = storyPageRepository
                .findByStoryPart_StoryLevel_IdAndStoryPart_TypeOrderByPageNumAsc(
                        storyLevel.getId(),
                        nextPartType
                );

        if (pages.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.STORY_PAGE_NOT_FOUND
            );
        }

        // 다음 파트에서 필요한 전체 문장 범위
        Integer startSentenceIdx =
                pages.get(0).getStartSentenceIdx();

        Integer endSentenceIdx =
                pages.get(pages.size() - 1).getEndSentenceIdx();

        // 필요한 문장을 DB에서 한 번에 조회
        List<StorySentence> allSentences = storySentenceRepository
                .findByStoryLevelIdAndSentenceIdxBetweenOrderBySentenceIdxAsc(
                        storyLevel.getId(),
                        startSentenceIdx,
                        endSentenceIdx
                );

        List<PageResponse> pageResponses = createPageResponses(pages, allSentences);
        // 최종 응답
        return new NextPartResponse(
                storyPart.getType(),
                storyPart.getOrderNum(),
                selectedLevel,
                pageResponses
        );
    }


    private List<PageResponse> createPageResponses(
            List<StoryPage> pages,
            List<StorySentence> allSentences
    ) {
        return pages.stream()
                .map(page -> {

                    // 해당 페이지 범위의 문장만 추출
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

                    // 이미지 URL 생성
                    String imageUrl = generateUrl(page.getImageKey());

                    // 음성 URL 생성
                    String audioUrl = generateUrl(page.getAudioKey());

                    return new PageResponse(
                            page.getId(),
                            page.getPageNum(),
                            imageUrl,
                            audioUrl,
                            sentenceResponses
                    );
                })
                .toList();
    }

    private String generateUrl(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return null;
        }

        return fileUrlProvider.generateUrl(objectKey);
    }
}