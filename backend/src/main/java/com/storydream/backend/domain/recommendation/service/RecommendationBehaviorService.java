package com.storydream.backend.domain.recommendation.service;

import com.storydream.backend.domain.reading.entity.ReadingStatus;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.recommendation.repository.RecommendationExposureRepository;
import com.storydream.backend.domain.recommendation.repository.StoryClickRepository;
import com.storydream.backend.domain.story.dto.AiReadingBehavior;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecommendationBehaviorService {

    private static final String CONCLUSION_PART_TYPE = "결론";
    private static final ZoneId READING_TIME_ZONE = ZoneId.of("Asia/Seoul");

    private final RecommendationExposureRepository recommendationExposureRepository;
    private final StoryClickRepository storyClickRepository;
    private final ReadingHistoryRepository readingHistoryRepository;
    private final ReadingLogRepository readingLogRepository;

    public List<AiReadingBehavior> getReadingBehaviors(
            Integer childId,
            String languageCode
    ) {
        Map<Integer, BehaviorCounts> countsByStory = new TreeMap<>();

        recommendationExposureRepository.countExposuresByStory(childId, languageCode)
                .forEach(row -> countsByStory
                        .computeIfAbsent(row.getOriginalStoryId(), ignored -> new BehaviorCounts())
                        .exposureCount = row.getEventCount());

        storyClickRepository.countClicksByStory(childId, languageCode)
                .forEach(row -> {
                    BehaviorCounts counts = countsByStory.computeIfAbsent(
                            row.getOriginalStoryId(),
                            ignored -> new BehaviorCounts()
                    );
                    counts.clickCount = row.getEventCount();
                    counts.updateLatest(row.getLatestEventAt());
                });

        readingHistoryRepository.countReadingBehaviorByStory(
                        childId,
                        languageCode,
                        ReadingStatus.COMPLETED
                )
                .forEach(row -> {
                    BehaviorCounts counts = countsByStory.computeIfAbsent(
                            row.getOriginalStoryId(),
                            ignored -> new BehaviorCounts()
                    );
                    counts.readingStartCount = row.getReadingStartCount();
                    counts.readingCompletionCount = row.getReadingCompletionCount();
                    counts.updateLatest(toOffsetDateTime(row.getLatestReadingStartedAt()));
                    counts.updateLatest(toOffsetDateTime(row.getLatestReadingCompletedAt()));
                });

        readingLogRepository.countBodyCompletionsByStory(
                        childId,
                        languageCode,
                        CONCLUSION_PART_TYPE
                )
                .forEach(row -> {
                    BehaviorCounts counts = countsByStory.computeIfAbsent(
                            row.getOriginalStoryId(),
                            ignored -> new BehaviorCounts()
                    );
                    counts.bodyCompletionCount = row.getEventCount();
                    counts.updateLatest(toOffsetDateTime(row.getLatestEventAt()));
                });

        return countsByStory.entrySet().stream()
                .map(entry -> entry.getValue().toDto(entry.getKey()))
                .toList();
    }

    private OffsetDateTime toOffsetDateTime(LocalDateTime value) {
        return value == null ? null : value.atZone(READING_TIME_ZONE).toOffsetDateTime();
    }

    private static final class BehaviorCounts {
        private long exposureCount;
        private long clickCount;
        private long readingStartCount;
        private long bodyCompletionCount;
        private long readingCompletionCount;
        private OffsetDateTime latestPositiveEventAt;

        private void updateLatest(OffsetDateTime candidate) {
            if (candidate != null && (
                    latestPositiveEventAt == null || candidate.isAfter(latestPositiveEventAt)
            )) {
                latestPositiveEventAt = candidate;
            }
        }

        private AiReadingBehavior toDto(Integer originalStoryId) {
            return new AiReadingBehavior(
                    originalStoryId,
                    exposureCount,
                    clickCount,
                    readingStartCount,
                    bodyCompletionCount,
                    readingCompletionCount,
                    latestPositiveEventAt
            );
        }
    }
}
