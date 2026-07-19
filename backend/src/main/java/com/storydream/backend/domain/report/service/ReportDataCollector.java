package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.child.entity.Child;
import com.storydream.backend.domain.quiz.entity.QuizResult;
import com.storydream.backend.domain.quiz.repository.QuizResultRepository;
import com.storydream.backend.domain.reading.entity.ReadingHistory;
import com.storydream.backend.domain.reading.entity.ReadingLog;
import com.storydream.backend.domain.reading.entity.ReadingStatus;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.report.dto.ReadingHistoryItemResponse;
import com.storydream.backend.domain.report.entity.AiReadingReport;
import com.storydream.backend.domain.report.entity.PartType;
import com.storydream.backend.domain.report.repository.AiReadingReportRepository;
import com.storydream.backend.global.exception.BusinessException;
import com.storydream.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * DB에서 리포트 재료를 모아 '순수 값(record)'으로 바꿔주는 컴포넌트.
 *
 * AI(GPT) 호출은 수 초가 걸리므로 트랜잭션 안에서 하면 DB 커넥션을 그만큼 잡고 있게 된다.
 * 그래서 [집계(읽기 TX)] → [AI 호출(TX 밖)] → [저장(쓰기 TX)] 으로 나누고,
 * 이 클래스는 첫 단계만 담당한다. 엔티티를 그대로 넘기면 트랜잭션 밖에서 지연 로딩이 터지므로
 * 반드시 record로 변환해서 반환한다.
 */
@Component
@RequiredArgsConstructor
public class ReportDataCollector {

    private final ReadingHistoryRepository readingHistoryRepository;
    private final ReadingLogRepository readingLogRepository;
    private final QuizResultRepository quizResultRepository;
    private final AiReadingReportRepository reportRepository;

    // =================================================================
    // 동화 1회 독서 집계
    // =================================================================
    @Transactional(readOnly = true)
    public ReportFacts collectStory(Integer readingHistoryId) {

        ReadingHistory history = readingHistoryRepository.findById(readingHistoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.READING_HISTORY_NOT_FOUND));

        if (history.getStatus() != ReadingStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.READING_NOT_COMPLETED);
        }

        Child child = history.getChild();

        // 1) 문단별 퀴즈 집계 (같은 퀴즈를 다시 제출했으면 마지막 제출만 인정)
        Map<Integer, QuizResult> latestResultByQuiz = new LinkedHashMap<>();
        for (QuizResult result : quizResultRepository.findAllWithQuizByReadingHistoryId(readingHistoryId)) {
            latestResultByQuiz.put(result.getQuiz().getId(), result);
        }

        Map<PartType, int[]> quizCountByPart = new EnumMap<>(PartType.class); // [total, correct]
        for (QuizResult result : latestResultByQuiz.values()) {
            PartType partType = PartType.from(result.getQuiz().getPartType());
            int[] counts = quizCountByPart.computeIfAbsent(partType, key -> new int[2]);
            counts[0]++;
            if (Boolean.TRUE.equals(result.getIsCorrect())) {
                counts[1]++;
            }
        }

        // 2) 문단별 난이도 (reading_log의 문단별 마지막 기록 = 그 문단을 읽을 때의 레벨)
        Map<PartType, Integer> levelByPart = new EnumMap<>(PartType.class);
        for (ReadingLog log : readingLogRepository.findByReadingHistoryIdOrderByIdAsc(readingHistoryId)) {
            levelByPart.put(PartType.from(log.getPartType()), log.getLevel());
        }

        // 3) 문단별 이탈 횟수 (focus_loss_log 테이블이 생기기 전까지는 비어 있음)
        Map<PartType, Integer> focusLossByPart = focusLossCounts(readingHistoryId);

        // 4) 서론 → 본론 → 결론 순으로 정리
        List<PartFact> parts = new ArrayList<>();
        int fallbackLevel = child.getDefaultLevel(); // 로그가 없으면 아이의 기본 레벨로 대체
        for (PartType partType : PartType.values()) {
            if (!quizCountByPart.containsKey(partType) && !levelByPart.containsKey(partType)) {
                continue; // 아예 읽지 않은 문단
            }
            int[] counts = quizCountByPart.getOrDefault(partType, new int[2]);
            int level = levelByPart.getOrDefault(partType, fallbackLevel);
            fallbackLevel = level;

            parts.add(new PartFact(
                    partType,
                    level,
                    counts[0],
                    counts[1],
                    percentage(counts[1], counts[0]),
                    focusLossByPart.get(partType)
            ));
        }

        int totalQuiz = parts.stream().mapToInt(PartFact::quizTotalCount).sum();
        int correctQuiz = parts.stream().mapToInt(PartFact::quizCorrectCount).sum();

        Integer totalFocusLoss = focusLossByPart.isEmpty()
                ? null
                : focusLossByPart.values().stream().mapToInt(Integer::intValue).sum();

        return new ReportFacts(
                readingHistoryId,
                child.getId(),
                child.getName(),
                ageOf(child),
                history.getOriginalStory().getTitle(),
                readingSeconds(history),
                totalQuiz,
                correctQuiz,
                percentage(correctQuiz, totalQuiz),
                parts.isEmpty() ? null : parts.get(0).level(),
                parts.isEmpty() ? null : parts.get(parts.size() - 1).level(),
                totalFocusLoss,
                parts
        );
    }

    // =================================================================
    // 기간(전체 요약) 집계
    // =================================================================
    @Transactional(readOnly = true)
    public PeriodFacts collectPeriod(Integer childId, LocalDate from, LocalDate to) {

        List<AiReadingReport> reports = reportRepository.findAllInPeriod(
                childId,
                ReadingStatus.COMPLETED,
                from.atStartOfDay(),
                to.plusDays(1).atStartOfDay()   // to 당일 23:59:59까지 포함
        );

        // 사이드바 목록
        List<ReadingHistoryItemResponse> histories = reports.stream()
                .sorted(Comparator.comparing(
                        (AiReadingReport r) -> r.getReadingHistory().getEndedAt()).reversed())
                .map(report -> {
                    ReadingHistory history = report.getReadingHistory();
                    return new ReadingHistoryItemResponse(
                            history.getId(),
                            history.getOriginalStory().getId(),
                            history.getOriginalStory().getTitle(),
                            history.getEndedAt().toLocalDate(),
                            report.getAverageQuizScore()
                    );
                })
                .toList();

        // 주차 버킷 : 화면이 5/1~5/7, 5/8~5/14 로 끊으므로 '조회 시작일 기준 7일'로 나눈다
        int bucketCount = (int) Math.ceil((ChronoUnit.DAYS.between(from, to) + 1) / 7.0);
        BigDecimal[] weeklySum = new BigDecimal[bucketCount];
        int[] weeklyCount = new int[bucketCount];
        Arrays.fill(weeklySum, BigDecimal.ZERO);

        BigDecimal totalScore = BigDecimal.ZERO;
        int totalSeconds = 0;

        for (AiReadingReport report : reports) {
            LocalDate endedOn = report.getReadingHistory().getEndedAt().toLocalDate();
            int index = (int) (ChronoUnit.DAYS.between(from, endedOn) / 7);
            if (index >= 0 && index < bucketCount) {
                weeklySum[index] = weeklySum[index].add(report.getAverageQuizScore());
                weeklyCount[index]++;
            }
            totalScore = totalScore.add(report.getAverageQuizScore());
            totalSeconds += report.getReadingSeconds();
        }

        List<WeeklyFact> weeklyScores = new ArrayList<>(bucketCount);
        for (int i = 0; i < bucketCount; i++) {
            LocalDate weekStart = from.plusDays(i * 7L);
            LocalDate weekEnd = weekStart.plusDays(6);
            if (weekEnd.isAfter(to)) {
                weekEnd = to;
            }
            BigDecimal average = weeklyCount[i] == 0
                    ? null
                    : weeklySum[i].divide(BigDecimal.valueOf(weeklyCount[i]), 1, RoundingMode.HALF_UP);
            weeklyScores.add(new WeeklyFact(i, weekStart, weekEnd, average, weeklyCount[i]));
        }

        int readingCount = reports.size();
        BigDecimal averageScore = readingCount == 0
                ? BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP)
                : totalScore.divide(BigDecimal.valueOf(readingCount), 1, RoundingMode.HALF_UP);

        // 프롬프트용 부가 정보
        Integer latestLevel = reports.stream()
                .filter(report -> report.getEndLevel() != null)
                .reduce((first, second) -> second)   // 마지막 독서
                .map(AiReadingReport::getEndLevel)
                .orElse(null);

        List<String> topStoryTitles = reports.stream()
                .map(report -> report.getReadingHistory().getOriginalStory().getTitle())
                .distinct()
                .limit(5)
                .toList();

        return new PeriodFacts(
                readingCount,
                averageScore,
                totalSeconds,
                latestLevel,
                topStoryTitles,
                weeklyScores,
                histories
        );
    }

    // =================================================================
    // 보조
    // =================================================================

    /**
     * 문단별 화면 이탈 횟수.
     * focus_loss_log 테이블이 생기면 여기서 조회해 반환하면 되고,
     * 리포트 저장/프롬프트/화면 코드는 손댈 필요가 없다.
     */
    private Map<PartType, Integer> focusLossCounts(Integer readingHistoryId) {
        return Map.of();
    }

    private int readingSeconds(ReadingHistory history) {
        LocalDateTime startedAt = history.getStartedAt();
        LocalDateTime endedAt = history.getEndedAt();
        if (startedAt == null || endedAt == null) {
            return 0;
        }
        return (int) Duration.between(startedAt, endedAt).toSeconds();
    }

    private Integer ageOf(Child child) {
        if (child.getBirthDate() == null) {
            return null;
        }
        return Period.between(child.getBirthDate(), LocalDate.now()).getYears();
    }

    /** 0 ~ 100 (소수 1자리). 분모가 0이면 0.0 */
    private BigDecimal percentage(int part, int total) {
        if (total == 0) {
            return BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(part)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }
}