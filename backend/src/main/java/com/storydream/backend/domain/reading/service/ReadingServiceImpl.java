package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.quiz.entity.Quiz;
import com.storydream.backend.domain.quiz.repository.QuizRepository;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
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

    private final QuizRepository quizRepository;
    private final QuizResultRepository quizResultRepository;
    private final DifficultyDecisionService difficultyDecisionService;

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
        // 퀴즈 제출과 동일한 독서 기록 행을 잠가 동시 전환을 직렬화한다.
        ReadingHistory readingHistory = readingHistoryRepository
                .findOwnedByIdForUpdate(
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

        String currentPartType = currentLog.getPartType();
        Integer currentLevel = currentLog.getLevel();

        // 결론은 퀴즈 제출 여부와 무관하게 기존 종료 API를 사용한다.
        if (!"서론".equals(currentPartType) && !"본론".equals(currentPartType)) {
            throw new BusinessException(ErrorCode.INVALID_NEXT_PART);
        }

        OriginalStory originalStory = readingHistory.getOriginalStory();
        validatePartQuizzesCompleted(readingHistoryId, originalStory.getId(), currentPartType);

        DifficultyDecisionResult decision = difficultyDecisionService.decide(
                readingHistoryId, currentPartType
        );
        Integer recommendedLevel = decision.nextLevel();
        Integer selectedLevel = request.selectedLevel();
        if (selectedLevel == null || selectedLevel < 1 || selectedLevel > 3
                || (!selectedLevel.equals(currentLevel) && !selectedLevel.equals(recommendedLevel))) {
            throw new BusinessException(ErrorCode.INVALID_STORY_LEVEL);
        }

        // 검증된 선택을 유지하여 다음 파트로 진행한다.
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

        if (readingLogRepository.existsByReadingHistoryIdAndPartType(readingHistoryId, nextPartType)) {
            throw new BusinessException(ErrorCode.DUPLICATE_NEXT_PART);
        }

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


    private void validatePartQuizzesCompleted(
            Integer readingHistoryId, Integer originalStoryId, String partType
    ) {
        List<Integer> quizIds = quizRepository
                .findByOriginalStoryIdAndPartTypeOrderByOrderNumAsc(originalStoryId, partType)
                .stream()
                .map(Quiz::getId)
                .toList();

        // 퀴즈가 없는 파트를 완료로 간주하지 않는다.
        if (quizIds.isEmpty()) {
            throw new BusinessException(ErrorCode.PART_QUIZZES_INCOMPLETE);
        }
        List<Integer> submittedQuizIds = quizResultRepository.findSubmittedQuizIds(readingHistoryId, quizIds);
        // 과거의 중복 결과나 다른 동화/파트의 결과로 누락된 문제를 채울 수 없다.
        if (!submittedQuizIds.containsAll(quizIds)) {
            throw new BusinessException(ErrorCode.PART_QUIZZES_INCOMPLETE);
        }
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
