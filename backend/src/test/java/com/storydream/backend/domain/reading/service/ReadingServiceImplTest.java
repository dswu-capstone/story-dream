package com.storydream.backend.domain.reading.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.child.repository.ChildRepository;
import com.storydream.backend.domain.focus.repository.FocusLogRepository;
import com.storydream.backend.domain.focus.service.FocusLogService;
import com.storydream.backend.domain.guardian.entity.Guardian;
import com.storydream.backend.domain.quiz.entity.Quiz;
import com.storydream.backend.domain.quiz.repository.QuizRepository;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
import com.storydream.backend.domain.recommendation.repository.RecommendationExposureRepository;
import com.storydream.backend.domain.recommendation.entity.Recommendation;
import com.storydream.backend.domain.recommendation.entity.RecommendationExposure;
import com.storydream.backend.domain.recommendation.entity.RecommendationItem;
import com.storydream.backend.domain.recommendation.entity.RecommendationInvalidationReason;
import com.storydream.backend.domain.recommendation.service.RecommendationInvalidationService;
import com.storydream.backend.domain.reading.dto.ReadingStartRequest;
import com.storydream.backend.domain.reading.dto.NextPartRequest;
import com.storydream.backend.domain.reading.dto.NextPartResponse;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.story.entity.*;
import com.storydream.backend.domain.story.repository.*;
import com.storydream.backend.global.common.PartType;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import com.storydream.backend.global.storage.FileUrlProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReadingServiceImplTest {
    private static final int HISTORY_ID = 10;
    private static final int GUARDIAN_ID = 7;
    private static final int STORY_ID = 20;
    private static final List<Integer> QUIZ_IDS = List.of(101, 102, 103, 104, 105);

    private final ReadingHistoryRepository histories = mock(ReadingHistoryRepository.class);
    private final ChildRepository children = mock(ChildRepository.class);
    private final OriginalStoryRepository originalStories = mock(OriginalStoryRepository.class);
    private final RecommendationExposureRepository recommendationExposures =
            mock(RecommendationExposureRepository.class);
    private final ReadingLogRepository logs = mock(ReadingLogRepository.class);
    private final QuizRepository quizzes = mock(QuizRepository.class);
    private final QuizResultRepository results = mock(QuizResultRepository.class);
    private final FocusLogRepository focus = mock(FocusLogRepository.class);
    private final StoryLevelRepository levels = mock(StoryLevelRepository.class);
    private final StoryPartRepository parts = mock(StoryPartRepository.class);
    private final StoryPageRepository pages = mock(StoryPageRepository.class);
    private final StorySentenceRepository sentences = mock(StorySentenceRepository.class);
    private final FileUrlProvider urls = mock(FileUrlProvider.class);
    private final FocusLogService focusLogService = mock(FocusLogService.class);
    private final RecommendationInvalidationService recommendationInvalidationService =
            mock(RecommendationInvalidationService.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private final DifficultyDecisionService decisions = spy(new DifficultyDecisionService(results, focus, logs));
    private ReadingServiceImpl service;
    private ReadingHistory history;

    @BeforeEach
    void setUp() {
        service = new ReadingServiceImpl(histories, children,
                originalStories, recommendationExposures, logs, levels,
                pages, parts, sentences, quizzes, results, decisions, urls,
                focusLogService, recommendationInvalidationService, eventPublisher);
        ReflectionTestUtils.setField(service, "koGeneratorType", "FINE_TUNED");
        ReflectionTestUtils.setField(service, "koVersion", "v1");
        OriginalStory story = mock(OriginalStory.class);
        Child child = mock(Child.class);
        when(child.getId()).thenReturn(11);
        when(story.getId()).thenReturn(STORY_ID);
        when(story.getLanguageCode()).thenReturn("ko");
        history = ReadingHistory.builder().child(child).originalStory(story).build();
        when(histories.findOwnedByIdForUpdate(HISTORY_ID, GUARDIAN_ID)).thenReturn(Optional.of(history));
    }

    @Test
    void linksMatchingRecommendationExposureWhenReadingStarts() {
        int childId = 11;
        long exposureId = 30L;
        Child child = mock(Child.class);
        OriginalStory story = mock(OriginalStory.class);
        Recommendation recommendation = mock(Recommendation.class);
        RecommendationItem item = mock(RecommendationItem.class);
        RecommendationExposure exposure = mock(RecommendationExposure.class);

        when(child.getId()).thenReturn(childId);
        when(child.getDefaultLevel()).thenReturn(1);
        when(story.getId()).thenReturn(STORY_ID);
        when(story.getLanguageCode()).thenReturn("ko");
        when(recommendation.getChild()).thenReturn(child);
        when(item.getRecommendation()).thenReturn(recommendation);
        when(item.getOriginalStory()).thenReturn(story);
        when(exposure.getRecommendationItem()).thenReturn(item);
        when(children.findByIdAndGuardianId(childId, GUARDIAN_ID)).thenReturn(Optional.of(child));
        when(originalStories.findById(STORY_ID)).thenReturn(Optional.of(story));
        when(recommendationExposures.findOwnedExposureForUpdate(exposureId, GUARDIAN_ID))
                .thenReturn(Optional.of(exposure));
        when(histories.save(any(ReadingHistory.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(levels.findByOriginalStoryIdAndLevelAndGeneratorTypeAndVersion(
                STORY_ID, 1, "FINE_TUNED", "v1"
        )).thenReturn(Optional.of(StoryLevel.builder().id(300).level(1).build()));
        when(parts.findByStoryLevelIdAndType(300, "서론"))
                .thenReturn(Optional.of(StoryPart.builder().type("서론").orderNum(1).build()));
        when(pages.findByStoryPart_StoryLevel_IdAndStoryPart_TypeOrderByPageNumAsc(300, "서론"))
                .thenReturn(List.of(StoryPage.builder().id(400).pageNum(1)
                        .startSentenceIdx(1).endSentenceIdx(1).build()));
        when(sentences.findByStoryLevelIdAndSentenceIdxBetweenOrderBySentenceIdxAsc(300, 1, 1))
                .thenReturn(List.of(StorySentence.builder().sentenceIdx(1).content("첫 문장").build()));

        service.startReading(
                GUARDIAN_ID,
                new ReadingStartRequest(childId, STORY_ID, exposureId)
        );

        ArgumentCaptor<ReadingHistory> saved = ArgumentCaptor.forClass(ReadingHistory.class);
        verify(histories).save(saved.capture());
        assertThat(saved.getValue().getRecommendationExposure()).isSameAs(exposure);
    }

    @ParameterizedTest
    @CsvSource({
            "2,4,1,3", // UP 수락
            "2,4,1,2", // UP 거절
            "2,3,2,2", // KEEP
            "3,4,1,3", // 최대 레벨에서 UP
            "1,2,3,1", // 최소 레벨에서 DOWN
            "2,2,3,1", // DOWN 수락
            "2,2,3,2"  // DOWN 거절
    })
    void usesAcceptedOrDeclinedLevelForBody(int current, long correct, long distracted, int selected) {
        givenCurrentPart("서론", current, correct, distracted);
        givenContent("본론", 2, selected);

        NextPartResponse response = submit(selected);

        assertThat(response.partType()).isEqualTo("본론");
        assertThat(response.partOrderNum()).isEqualTo(2);
        assertThat(response.level()).isEqualTo(selected);
        assertThat(response.pages()).hasSize(1);
        assertThat(response.pages().get(0).pageId()).isEqualTo(400);
        assertThat(response.pages().get(0).sentences().get(0).content()).isEqualTo("다음 파트 문장");
        ArgumentCaptor<ReadingLog> saved = ArgumentCaptor.forClass(ReadingLog.class);
        verify(logs).save(saved.capture());
        assertThat(saved.getValue().getPartType()).isEqualTo("본론");
        assertThat(saved.getValue().getLevel()).isEqualTo(selected);
        assertThat(saved.getValue().getReadingHistory()).isSameAs(history);
        verify(levels).findByOriginalStoryIdAndLevelAndGeneratorTypeAndVersion(
                STORY_ID, selected, "FINE_TUNED", "v1");

        var order = inOrder(histories, logs, quizzes, results, decisions, levels, parts, pages);
        order.verify(histories).findOwnedByIdForUpdate(HISTORY_ID, GUARDIAN_ID);
        order.verify(logs).findTopByReadingHistoryIdOrderByIdDesc(HISTORY_ID);
        order.verify(quizzes).findByOriginalStoryIdAndPartTypeOrderByOrderNumAsc(STORY_ID, "서론");
        order.verify(results).findSubmittedQuizIds(HISTORY_ID, QUIZ_IDS);
        order.verify(decisions).decide(HISTORY_ID, "서론");
        order.verify(levels).findByOriginalStoryIdAndLevelAndGeneratorTypeAndVersion(
                STORY_ID, selected, "FINE_TUNED", "v1");
        order.verify(parts).findByStoryLevelIdAndType(300, "본론");
        order.verify(logs).save(any(ReadingLog.class));
        order.verify(pages).findByStoryPart_StoryLevel_IdAndStoryPart_TypeOrderByPageNumAsc(300, "본론");
    }

    @ParameterizedTest
    @CsvSource({"4,1,1", "3,2,3", "3,2,1", "4,1,0", "4,1,4"})
    void rejectsUnapprovedLevel(long correct, long distracted, int selected) {
        givenCurrentPart("서론", 2, correct, distracted);
        assertFailure(selected, ErrorCode.INVALID_STORY_LEVEL);
        verifyNoInteractions(levels, parts);
        verify(logs, never()).save(any());
    }

    @Test
    void rejectsNullSelectedLevelAlsoWhenCalledWithoutControllerValidation() {
        givenCurrentPart("서론", 2, 4, 1);
        assertFailure(null, ErrorCode.INVALID_STORY_LEVEL);
        verify(logs, never()).save(any());
    }

    @Test
    void requiresEveryQuizRatherThanJustLastQuiz() {
        givenCurrentPart("서론", 2, 4, 1);
        when(results.findSubmittedQuizIds(HISTORY_ID, QUIZ_IDS)).thenReturn(List.of(101, 102, 105));
        assertFailure(3, ErrorCode.PART_QUIZZES_INCOMPLETE);
        verifyNoInteractions(decisions, levels);
        verify(logs, never()).save(any());
    }

    @Test
    void duplicateAnswersOrUnrelatedQuizIdsCannotSubstituteMissingQuiz() {
        givenCurrentPart("서론", 2, 4, 1);
        when(results.findSubmittedQuizIds(HISTORY_ID, QUIZ_IDS))
                .thenReturn(List.of(101, 102, 103, 103, 999));
        assertFailure(3, ErrorCode.PART_QUIZZES_INCOMPLETE);
        verifyNoInteractions(decisions);
    }

    @Test
    void partWithNoQuizzesIsNotComplete() {
        givenCurrentPart("서론", 2, 4, 1);
        when(quizzes.findByOriginalStoryIdAndPartTypeOrderByOrderNumAsc(STORY_ID, "서론"))
                .thenReturn(List.of());
        assertFailure(3, ErrorCode.PART_QUIZZES_INCOMPLETE);
        verify(results, never()).findSubmittedQuizIds(anyInt(), anyList());
        verifyNoInteractions(decisions);
    }

    @Test
    void repeatedRequestAfterTransitionDoesNotCreateAnotherLog() {
        givenCurrentPart("서론", 2, 4, 1);
        givenContent("본론", 2, 3);
        AtomicReference<ReadingLog> latest = new AtomicReference<>(log("서론", 2));
        when(logs.findTopByReadingHistoryIdOrderByIdDesc(HISTORY_ID))
                .thenAnswer(invocation -> Optional.of(latest.get()));
        when(logs.save(any(ReadingLog.class))).thenAnswer(invocation -> {
            ReadingLog saved = invocation.getArgument(0);
            latest.set(saved);
            return saved;
        });
        // 두 번째 요청은 잠금 획득 후 새 현재 파트를 조회한다. 본론 퀴즈는 아직 미제출이다.
        List<Quiz> bodyQuizzes = List.of(quiz(201));
        when(quizzes.findByOriginalStoryIdAndPartTypeOrderByOrderNumAsc(STORY_ID, "본론"))
                .thenReturn(bodyQuizzes);
        when(results.findSubmittedQuizIds(HISTORY_ID, List.of(201))).thenReturn(List.of());

        submit(3);
        assertFailure(3, ErrorCode.PART_QUIZZES_INCOMPLETE);

        verify(logs, times(1)).save(any());
        verify(histories, times(2)).findOwnedByIdForUpdate(HISTORY_ID, GUARDIAN_ID);
        verify(decisions, times(1)).decide(HISTORY_ID, "서론");
        verify(decisions, never()).decide(HISTORY_ID, "본론");
    }

    @Test
    void rejectsAlreadyExistingTargetPart() {
        givenCurrentPart("서론", 2, 4, 1);
        when(logs.existsByReadingHistoryIdAndPartType(HISTORY_ID, "본론")).thenReturn(true);
        assertFailure(3, ErrorCode.DUPLICATE_NEXT_PART);
        verify(logs, never()).save(any());
        verifyNoInteractions(levels);
    }

    @Test
    void bodyTransitionsToConclusion() {
        givenCurrentPart("본론", 2, 3, 2);
        givenContent("결론", 3, 2);
        NextPartResponse response = submit(2);
        assertThat(response.partType()).isEqualTo("결론");
        assertThat(response.partOrderNum()).isEqualTo(3);
        verify(decisions).decide(HISTORY_ID, "본론");
        verify(logs).save(argThat(value -> "결론".equals(value.getPartType()) && value.getLevel() == 2));
        verify(recommendationInvalidationService).invalidateActive(
                11,
                "ko",
                RecommendationInvalidationReason.BODY_COMPLETED
        );
    }

    @Test
    void completedReadingInvalidatesRecommendationsOnlyOnce() {
        Guardian guardian = mock(Guardian.class);
        when(guardian.getId()).thenReturn(GUARDIAN_ID);
        when(history.getChild().getGuardian()).thenReturn(guardian);
        when(histories.findById(HISTORY_ID)).thenReturn(Optional.of(history));

        service.endReading(GUARDIAN_ID, HISTORY_ID);
        service.endReading(GUARDIAN_ID, HISTORY_ID);

        verify(recommendationInvalidationService, times(1)).invalidateActive(
                11,
                "ko",
                RecommendationInvalidationReason.READING_COMPLETED
        );
        verify(focusLogService, times(1)).closeAllOpen(eq(HISTORY_ID), any());
    }

    @Test
    void conclusionCannotAdvanceEvenWithoutQuizResults() {
        when(logs.findTopByReadingHistoryIdOrderByIdDesc(HISTORY_ID))
                .thenReturn(Optional.of(log("결론", 2)));
        assertFailure(2, ErrorCode.INVALID_NEXT_PART);
        verifyNoInteractions(quizzes, results, decisions);
        verify(logs, never()).save(any());
    }

    @Test
    void ownershipMismatchUsesExistingNotFoundError() {
        when(histories.findOwnedByIdForUpdate(HISTORY_ID, GUARDIAN_ID)).thenReturn(Optional.empty());
        assertFailure(2, ErrorCode.READING_HISTORY_NOT_FOUND);
        verifyNoInteractions(logs, quizzes, decisions);
    }

    @Test
    void missingReadingLogUsesExistingError() {
        assertFailure(2, ErrorCode.READING_LOG_NOT_FOUND);
        verifyNoInteractions(quizzes, decisions);
    }

    @Test
    void missingStoryLevelDoesNotSaveNextLog() {
        givenCurrentPart("서론", 2, 4, 1);
        assertFailure(3, ErrorCode.STORY_LEVEL_NOT_FOUND);
        verify(logs, never()).save(any());
    }

    @Test
    void missingStoryPartDoesNotSaveNextLog() {
        givenCurrentPart("서론", 2, 4, 1);
        givenContent("본론", 2, 3);
        when(parts.findByStoryLevelIdAndType(300, "본론")).thenReturn(Optional.empty());
        assertFailure(3, ErrorCode.STORY_PART_NOT_FOUND);
        verify(logs, never()).save(any());
    }

    @Test
    void missingPagesPropagatesBusinessExceptionToTransactionalCaller() {
        givenCurrentPart("서론", 2, 4, 1);
        givenContent("본론", 2, 3);
        when(pages.findByStoryPart_StoryLevel_IdAndStoryPart_TypeOrderByPageNumAsc(300, "본론"))
                .thenReturn(List.of());
        assertFailure(3, ErrorCode.STORY_PAGE_NOT_FOUND);
        // 실제 DB 롤백은 Spring @Transactional 경계가 담당한다.
    }

    private void givenCurrentPart(String type, int level, long correct, long distracted) {
        ReadingLog current = log(type, level);
        when(logs.findTopByReadingHistoryIdOrderByIdDesc(HISTORY_ID)).thenReturn(Optional.of(current));
        when(logs.findTopByReadingHistoryIdAndPartTypeOrderByIdDesc(HISTORY_ID, type))
                .thenReturn(Optional.of(current));
        List<Quiz> partQuizzes = QUIZ_IDS.stream().map(this::quiz).toList();
        when(quizzes.findByOriginalStoryIdAndPartTypeOrderByOrderNumAsc(STORY_ID, type))
                .thenReturn(partQuizzes);
        when(results.findSubmittedQuizIds(HISTORY_ID, QUIZ_IDS)).thenReturn(QUIZ_IDS);
        when(results.countCorrectByReadingHistoryIdAndPartType(HISTORY_ID, type)).thenReturn(correct);
        when(focus.countByReadingHistoryIdAndPartType(HISTORY_ID, PartType.fromDbValue(type)))
                .thenReturn(distracted);
    }

    private void givenContent(String type, int order, int level) {
        when(levels.findByOriginalStoryIdAndLevelAndGeneratorTypeAndVersion(STORY_ID, level, "FINE_TUNED", "v1"))
                .thenReturn(Optional.of(StoryLevel.builder().id(300).level(level).build()));
        when(parts.findByStoryLevelIdAndType(300, type))
                .thenReturn(Optional.of(StoryPart.builder().type(type).orderNum(order).build()));
        when(pages.findByStoryPart_StoryLevel_IdAndStoryPart_TypeOrderByPageNumAsc(300, type))
                .thenReturn(List.of(StoryPage.builder().id(400).pageNum(1)
                        .startSentenceIdx(10).endSentenceIdx(10).build()));
        when(sentences.findByStoryLevelIdAndSentenceIdxBetweenOrderBySentenceIdxAsc(300, 10, 10))
                .thenReturn(List.of(StorySentence.builder().sentenceIdx(10).content("다음 파트 문장").build()));
    }

    private Quiz quiz(int id) {
        Quiz quiz = mock(Quiz.class);
        when(quiz.getId()).thenReturn(id);
        return quiz;
    }

    private ReadingLog log(String type, int level) {
        return ReadingLog.builder().readingHistory(history).partType(type).level(level).build();
    }

    private NextPartResponse submit(Integer selected) {
        return service.startNextPart(GUARDIAN_ID, HISTORY_ID, new NextPartRequest(selected));
    }

    private void assertFailure(Integer selected, ErrorCode expected) {
        assertThatThrownBy(() -> submit(selected))
                .isInstanceOfSatisfying(BusinessException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(expected));
    }
}
