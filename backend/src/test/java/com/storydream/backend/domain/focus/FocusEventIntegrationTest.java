package com.storydream.backend.domain.focus;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.focus.controller.FocusLogController;
import com.storydream.backend.domain.focus.dto.FocusEventRequest;
import com.storydream.backend.domain.focus.dto.FocusEventResponse;
import com.storydream.backend.domain.focus.entity.*;
import com.storydream.backend.domain.focus.repository.FocusLogRepository;
import com.storydream.backend.domain.focus.service.FocusLogService;
import com.storydream.backend.domain.guardian.entity.Guardian;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.repository.*;
import com.storydream.backend.domain.reading.service.DifficultyDecision;
import com.storydream.backend.domain.reading.service.DifficultyDecisionService;
import com.storydream.backend.domain.story.entity.OriginalStory;
import com.storydream.backend.global.common.PartType;
import com.storydream.backend.global.exception.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

import static com.storydream.backend.domain.focus.dto.FocusEventResponse.Status.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 운영 설정을 읽지 않는 H2/JPA 테스트. 실제 트랜잭션, 저장, COUNT, UNIQUE, 행 잠금을 검증한다. */
@SpringJUnitConfig(FocusEventIntegrationTest.Config.class)
class FocusEventIntegrationTest {
    @Configuration
    @EnableTransactionManagement
    @EnableJpaRepositories(basePackageClasses = {FocusLogRepository.class, ReadingHistoryRepository.class})
    @Import({FocusLogService.class, DifficultyDecisionService.class})
    static class Config {
        @Bean(destroyMethod = "close") DataSource dataSource() {
            var pool = new HikariDataSource();
            pool.setJdbcUrl("jdbc:h2:mem:focus-events;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000");
            pool.setUsername("sa");
            pool.setPassword("");
            pool.setMaximumPoolSize(4);
            return pool;
        }

        @Bean LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource dataSource) {
            var factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(dataSource);
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setManagedTypes(PersistenceManagedTypes.of(
                    FocusLog.class.getName(), ReadingHistory.class.getName(), ReadingLog.class.getName(),
                    Child.class.getName(), Guardian.class.getName(), OriginalStory.class.getName()));
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop"));
            return factory;
        }

        @Bean PlatformTransactionManager transactionManager(EntityManagerFactory factory) {
            return new JpaTransactionManager(factory);
        }

        @Bean QuizResultRepository quizResultRepository() {
            return mock(QuizResultRepository.class);
        }
    }

    @Autowired FocusLogService service;
    @Autowired FocusLogRepository focusLogs;
    @Autowired ReadingHistoryRepository histories;
    @Autowired ReadingLogRepository readingLogs;
    @Autowired DifficultyDecisionService difficulty;
    @Autowired QuizResultRepository quizResults;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired EntityManagerFactory entityManagerFactory;
    private EntityManager em;
    private Integer historyId;
    private final LocalDateTime occurredAt = LocalDateTime.of(2026, 9, 18, 10, 15, 30);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        em = SharedEntityManagerCreator.createSharedEntityManager(entityManagerFactory);
        historyId = tx(() -> {
            Guardian guardian = Guardian.builder().loginId(UUID.randomUUID().toString())
                    .password("test-only").name("guardian").build();
            em.persist(guardian);
            Child child = Child.builder().guardian(guardian).name("child").interest(new String[]{"animal"})
                    .birthDate(LocalDate.of(2020, 1, 1)).defaultLevel(2).build();
            em.persist(child);
            OriginalStory story = new OriginalStory();
            ReflectionTestUtils.setField(story, "title", "test");
            ReflectionTestUtils.setField(story, "contentUrl", "test");
            ReflectionTestUtils.setField(story, "languageCode", "ko");
            ReflectionTestUtils.setField(story, "createdAt", occurredAt.minusDays(1));
            ReflectionTestUtils.setField(story, "updatedAt", occurredAt.minusDays(1));
            em.persist(story);
            ReadingHistory history = ReadingHistory.builder().child(child).originalStory(story).build();
            em.persist(history);
            em.persist(ReadingLog.builder().readingHistory(history).partType("서론").level(2).build());
            return history.getId();
        });
        when(quizResults.countCorrectByReadingHistoryIdAndPartType(historyId, "서론")).thenReturn(4L);
        mvc = MockMvcBuilders.standaloneSetup(new FocusLogController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void savesConfirmedEventAndReturnsUpFromActualStoredCount() {
        var response = service.handleEvent(historyId, request("A"));
        assertThat(response.status()).isEqualTo(SAVED);
        FocusLog log = focusLogs.findById(response.logId()).orElseThrow();
        assertThat(log.getPartType()).isEqualTo(PartType.INTRO);
        assertThat(log.getLevel()).isEqualTo(2);
        assertThat(log.getDurationSec()).isEqualTo(10);
        assertThat(log.getStartedAt()).isEqualTo(occurredAt.minusSeconds(10));
        assertThat(log.isOpen()).isTrue();
        var result = difficulty.decide(historyId, "서론");
        assertThat(result.distractionCount()).isEqualTo(1);
        assertThat(result.decision()).isEqualTo(DifficultyDecision.UP);
        assertThat(result.nextLevel()).isEqualTo(3);
    }

    @Test
    void retriesDoNotAddRowsOrChangeFirstPayload() {
        var first = service.handleEvent(historyId, request("A"));
        for (int i = 0; i < 3; i++) {
            var retry = service.handleEvent(historyId,
                    new FocusEventRequest("A", occurredAt.plusSeconds(20), 30, "absent"));
            assertThat(retry).isEqualTo(new FocusEventResponse(first.logId(), ALREADY_PROCESSED));
        }
        assertThat(focusLogs.findById(first.logId()).orElseThrow().getDurationSec()).isEqualTo(10);
        assertThat(difficulty.decide(historyId, "서론").distractionCount()).isEqualTo(1);
    }

    @Test
    void distinctEpisodesProduceCountsOneTwoThreeAndKeepFullDuration() {
        for (int i = 1; i <= 3; i++) {
            String id = "event-" + i;
            LocalDateTime at = occurredAt.plusMinutes(i);
            service.handleEvent(historyId, new FocusEventRequest(id, at, 10, null));
            var recovered = new FocusEventRequest(id, at.plusSeconds(20), 30, "focus_recovered");
            assertThat(service.handleEvent(historyId, recovered).status()).isEqualTo(RECOVERED);
            assertThat(service.handleEvent(historyId, recovered).status()).isEqualTo(ALREADY_PROCESSED);
            assertThat(difficulty.decide(historyId, "서론").distractionCount()).isEqualTo(i);
        }
        var stats = focusLogs.findPartStatsByReadingHistoryId(historyId).getFirst();
        assertThat(stats.getDistractionCount()).isEqualTo(3);
        assertThat(stats.getDistractionSec()).isEqualTo(90);
    }

    @Test
    void serverIgnoresClientPartAndLevelAndUsesLatestReadingLog() throws Exception {
        nextLog();
        mvc.perform(post(endpoint()).contentType("application/json").content("""
                {"eventId":"A","occurredAt":"2026-09-18T10:15:30","durationSeconds":10,
                 "partType":"INTRO","level":1}
                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("SAVED"));
        var log = focusLogs.findByReadingHistoryIdAndEventId(historyId, "A").orElseThrow();
        assertThat(log.getPartType()).isEqualTo(PartType.BODY);
        assertThat(log.getLevel()).isEqualTo(3);
    }

    @Test
    void retryAfterPartTransitionKeepsOriginalAttributionAndRecoveryClosesOriginal() {
        var first = service.handleEvent(historyId, request("A"));
        nextLog();
        assertThat(service.handleEvent(historyId, request("A")).logId()).isEqualTo(first.logId());
        service.handleEvent(historyId, new FocusEventRequest("A", occurredAt.plusSeconds(20), 30, "focus_recovered"));
        var log = focusLogs.findById(first.logId()).orElseThrow();
        assertThat(log.getPartType()).isEqualTo(PartType.INTRO);
        assertThat(log.getDurationSec()).isEqualTo(30);
        assertThat(focusLogs.countByReadingHistoryIdAndPartType(historyId, PartType.BODY)).isZero();
    }

    @Test
    void rejectsMissingHistory() {
        assertError(() -> service.handleEvent(Integer.MAX_VALUE, request("A")), ErrorCode.READING_HISTORY_NOT_FOUND);
    }

    @Test
    void rejectsMissingReadingLog() {
        tx(() -> {
            readingLogs.deleteAll(readingLogs.findAllByReadingHistoryIdOrderByCreatedAtAsc(historyId));
            return null;
        });
        assertError(() -> service.handleEvent(historyId, request("A")), ErrorCode.READING_LOG_NOT_FOUND);
        assertThat(focusLogs.findByReadingHistoryIdAndEventId(historyId, "A")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {-10, 0, 1, 9})
    void rejectsShortDurationAtHttpBoundaryAndService(int seconds) throws Exception {
        mvc.perform(post(endpoint()).contentType("application/json").content("""
                {"eventId":"A","occurredAt":"2026-09-18T10:15:30","durationSeconds":%d}
                """.formatted(seconds)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        assertError(() -> service.handleEvent(historyId,
                new FocusEventRequest("A", occurredAt, seconds, null)), ErrorCode.INVALID_FOCUS_EVENT);
        assertThat(focusLogs.findByReadingHistoryIdAndEventId(historyId, "A")).isEmpty();
    }

    @Test
    void rejectsMissingFieldsAndHeartbeat() throws Exception {
        for (String body : List.of("{}", """
                {"eventId":"A","occurredAt":"2026-09-18T10:15:30","durationSeconds":10,"eventType":"focus_state"}
                """)) {
            mvc.perform(post(endpoint()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void malformedJsonAndWrongFieldTypesReturnCommonBadRequestResponse() throws Exception {
        for (String body : List.of("{", """
                {"eventId":"A","occurredAt":"not-a-date","durationSeconds":10}
                """, """
                {"eventId":"A","occurredAt":"2026-09-18T10:15:30","durationSeconds":"ten"}
                """)) {
            mvc.perform(post(endpoint()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        }
    }

    @Test
    void recoveryCannotCreateRowOrShortenConfirmedDuration() {
        assertError(() -> service.handleEvent(historyId,
                new FocusEventRequest("A", occurredAt, 10, "focus_recovered")), ErrorCode.FOCUS_EVENT_NOT_FOUND);
        service.handleEvent(historyId, request("A"));
        assertError(() -> service.handleEvent(historyId,
                new FocusEventRequest("A", occurredAt.minusSeconds(5), 10, "focus_recovered")),
                ErrorCode.INVALID_FOCUS_EVENT);
        assertThat(focusLogs.findByReadingHistoryIdAndEventId(historyId, "A").orElseThrow().isOpen()).isTrue();
    }

    @Test
    void legacyRowsRemainInReportsButNotConfirmedDifficultyCount() {
        tx(() -> {
            FocusLog legacy = FocusLog.builder().readingHistory(histories.findById(historyId).orElseThrow())
                    .partType(PartType.INTRO).level(2).eventType(FocusEventType.FOCUS_LOST)
                    .state(FocusStatus.SIDE).startedAt(occurredAt.minusSeconds(20)).build();
            legacy.close(occurredAt);
            focusLogs.saveAndFlush(legacy);
            return null;
        });
        service.handleEvent(historyId, request("A"));
        assertThat(difficulty.decide(historyId, "서론").distractionCount()).isEqualTo(1);
        var stats = focusLogs.findPartStatsByReadingHistoryId(historyId).getFirst();
        assertThat(stats.getDistractionCount()).isEqualTo(2);
        assertThat(stats.getDistractionSec()).isEqualTo(30);
    }

    @Test
    void concurrentRetriesCommitOnlyOneRow() throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            CountDownLatch start = new CountDownLatch(1);
            Callable<FocusEventResponse> send = () -> {
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return service.handleEvent(historyId, request("concurrent"));
            };
            Future<FocusEventResponse> first = executor.submit(send);
            Future<FocusEventResponse> second = executor.submit(send);
            start.countDown();
            var a = first.get(15, TimeUnit.SECONDS);
            var b = second.get(15, TimeUnit.SECONDS);
            assertThat(a.logId()).isEqualTo(b.logId());
            assertThat(List.of(a.status(), b.status())).containsExactlyInAnyOrder(SAVED, ALREADY_PROCESSED);
        }
        assertThat(difficulty.decide(historyId, "서론").distractionCount()).isEqualTo(1);
    }

    @Test
    void databaseUniqueConstraintAlsoRejectsWriterThatBypassesServiceLock() {
        service.handleEvent(historyId, request("A"));
        assertThatThrownBy(() -> tx(() -> focusLogs.saveAndFlush(FocusLog.builder()
                .readingHistory(histories.findById(historyId).orElseThrow())
                .partType(PartType.INTRO).level(2).eventId("A").durationSec(10)
                .eventType(FocusEventType.FOCUS_LOST).state(FocusStatus.DISTRACTED)
                .startedAt(occurredAt.minusSeconds(10)).build())))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(difficulty.decide(historyId, "서론").distractionCount()).isEqualTo(1);
    }

    @Test
    void closeAllOpenRetainsReadingCompletionReportBehavior() {
        service.handleEvent(historyId, request("A"));
        service.closeAllOpen(historyId, occurredAt.plusSeconds(20));
        assertThat(focusLogs.findByReadingHistoryIdAndEventId(historyId, "A").orElseThrow().getDurationSec())
                .isEqualTo(30);
        assertThat(difficulty.decide(historyId, "서론").distractionCount()).isEqualTo(1);
    }

    private FocusEventRequest request(String id) { return new FocusEventRequest(id, occurredAt, 10, null); }
    private String endpoint() { return "/api/reading-histories/" + historyId + "/focus-events"; }
    private <T> T tx(Supplier<T> action) {
        return new TransactionTemplate(transactionManager).execute(status -> action.get());
    }
    private void nextLog() {
        tx(() -> readingLogs.saveAndFlush(ReadingLog.builder()
                .readingHistory(histories.findById(historyId).orElseThrow()).partType("본론").level(3).build()));
    }
    private void assertError(Runnable action, ErrorCode code) {
        assertThatThrownBy(action::run).isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(code);
    }
}
