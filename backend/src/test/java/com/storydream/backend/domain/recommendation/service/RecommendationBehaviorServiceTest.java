package com.storydream.backend.domain.recommendation.service;

import com.storydream.backend.domain.reading.entity.ReadingStatus;
import com.storydream.backend.domain.reading.repository.ReadingHistoryRepository;
import com.storydream.backend.domain.reading.repository.ReadingLogRepository;
import com.storydream.backend.domain.recommendation.repository.RecommendationExposureRepository;
import com.storydream.backend.domain.recommendation.repository.StoryClickRepository;
import com.storydream.backend.domain.recommendation.repository.projection.StoryEventCountProjection;
import com.storydream.backend.domain.recommendation.repository.projection.StoryLocalEventCountProjection;
import com.storydream.backend.domain.recommendation.repository.projection.StoryOffsetEventCountProjection;
import com.storydream.backend.domain.recommendation.repository.projection.StoryReadingCountProjection;
import com.storydream.backend.domain.story.dto.AiReadingBehavior;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RecommendationBehaviorServiceTest {

    private final RecommendationExposureRepository exposures =
            mock(RecommendationExposureRepository.class);
    private final StoryClickRepository clicks = mock(StoryClickRepository.class);
    private final ReadingHistoryRepository histories = mock(ReadingHistoryRepository.class);
    private final ReadingLogRepository logs = mock(ReadingLogRepository.class);
    private RecommendationBehaviorService service;

    @BeforeEach
    void setUp() {
        service = new RecommendationBehaviorService(exposures, clicks, histories, logs);
    }

    @Test
    void mergesAllBehaviorSourcesByStoryInStableOrder() {
        StoryEventCountProjection story205Exposures = eventCount(205, 4);
        StoryEventCountProjection story101Exposures = eventCount(101, 3);
        StoryOffsetEventCountProjection story101Clicks = offsetEventCount(
                101, 2, OffsetDateTime.parse("2026-10-01T10:00:00+09:00")
        );
        StoryReadingCountProjection story101Reading = readingCount(
                101, 2, 1,
                LocalDateTime.parse("2026-10-02T10:00:00"),
                LocalDateTime.parse("2026-10-03T10:00:00")
        );
        StoryReadingCountProjection story300Reading = readingCount(
                300, 1, 0,
                LocalDateTime.parse("2026-10-02T10:00:00"),
                null
        );
        StoryLocalEventCountProjection story101BodyCompletions = localEventCount(
                101, 1, LocalDateTime.parse("2026-10-04T10:00:00")
        );

        when(exposures.countExposuresByStory(11, "ko"))
                .thenReturn(List.of(story205Exposures, story101Exposures));
        when(clicks.countClicksByStory(11, "ko"))
                .thenReturn(List.of(story101Clicks));
        when(histories.countReadingBehaviorByStory(11, "ko", ReadingStatus.COMPLETED))
                .thenReturn(List.of(story101Reading, story300Reading));
        when(logs.countBodyCompletionsByStory(11, "ko", "결론"))
                .thenReturn(List.of(story101BodyCompletions));

        List<AiReadingBehavior> result = service.getReadingBehaviors(11, "ko");

        assertThat(result).containsExactly(
                new AiReadingBehavior(
                        101, 3, 2, 2, 1, 1,
                        OffsetDateTime.parse("2026-10-04T10:00:00+09:00")
                ),
                new AiReadingBehavior(205, 4, 0, 0, 0, 0, null),
                new AiReadingBehavior(
                        300, 0, 0, 1, 0, 0,
                        OffsetDateTime.parse("2026-10-02T10:00:00+09:00")
                )
        );
    }

    @Test
    void returnsEmptyListWhenChildHasNoLogs() {
        when(exposures.countExposuresByStory(11, "en")).thenReturn(List.of());
        when(clicks.countClicksByStory(11, "en")).thenReturn(List.of());
        when(histories.countReadingBehaviorByStory(11, "en", ReadingStatus.COMPLETED))
                .thenReturn(List.of());
        when(logs.countBodyCompletionsByStory(11, "en", "결론")).thenReturn(List.of());

        assertThat(service.getReadingBehaviors(11, "en")).isEmpty();
    }

    private StoryEventCountProjection eventCount(Integer storyId, long count) {
        StoryEventCountProjection projection = mock(StoryEventCountProjection.class);
        when(projection.getOriginalStoryId()).thenReturn(storyId);
        when(projection.getEventCount()).thenReturn(count);
        return projection;
    }

    private StoryReadingCountProjection readingCount(
            Integer storyId,
            long startCount,
            long completionCount,
            LocalDateTime latestStartedAt,
            LocalDateTime latestCompletedAt
    ) {
        StoryReadingCountProjection projection = mock(StoryReadingCountProjection.class);
        when(projection.getOriginalStoryId()).thenReturn(storyId);
        when(projection.getReadingStartCount()).thenReturn(startCount);
        when(projection.getReadingCompletionCount()).thenReturn(completionCount);
        when(projection.getLatestReadingStartedAt()).thenReturn(latestStartedAt);
        when(projection.getLatestReadingCompletedAt()).thenReturn(latestCompletedAt);
        return projection;
    }

    private StoryOffsetEventCountProjection offsetEventCount(
            Integer storyId,
            long count,
            OffsetDateTime latestEventAt
    ) {
        StoryOffsetEventCountProjection projection = mock(StoryOffsetEventCountProjection.class);
        when(projection.getOriginalStoryId()).thenReturn(storyId);
        when(projection.getEventCount()).thenReturn(count);
        when(projection.getLatestEventAt()).thenReturn(latestEventAt);
        return projection;
    }

    private StoryLocalEventCountProjection localEventCount(
            Integer storyId,
            long count,
            LocalDateTime latestEventAt
    ) {
        StoryLocalEventCountProjection projection = mock(StoryLocalEventCountProjection.class);
        when(projection.getOriginalStoryId()).thenReturn(storyId);
        when(projection.getEventCount()).thenReturn(count);
        when(projection.getLatestEventAt()).thenReturn(latestEventAt);
        return projection;
    }
}
