from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.recommendation.metadata_embedding_store import MetadataEmbeddingStore
from app.recommendation.recommendation_api import create_app
from app.recommendation.recommendation_engine import (
    InterestVector,
    MetadataVector,
    ReadingBehavior,
    RecommendationScorer,
    ScoringConfig,
    StoryCandidate,
)


def story(story_id: int, title: str, embedding: tuple[float, float]) -> StoryCandidate:
    return StoryCandidate(
        story_id=story_id,
        title=title,
        language_code="ko",
        metadata=(MetadataVector(title, "TAG", embedding),),
    )


class FakeEmbeddingClient:
    def embed(self, texts: list[str]) -> list[list[float]]:
        return [[1.0, 0.0] for _ in texts]


class BehaviorRecommendationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.stories = (
            story(1, "동물", (1.0, 0.0)),
            story(2, "우주", (0.0, 1.0)),
            story(3, "별 탐험", (0.0, 1.0)),
        )
        self.interests = (InterestVector("동물", (1.0, 0.0)),)

    def test_no_positive_behavior_preserves_interest_only_score(self) -> None:
        ranked = RecommendationScorer().rank(
            self.interests,
            self.stories,
            (ReadingBehavior(story_id=2, exposure_count=5),),
        )

        self.assertEqual(ranked[0].story_id, 1)
        self.assertEqual(ranked[0].score, ranked[0].interest_score)
        self.assertFalse(ranked[0].behavior_applied)

    def test_completed_story_builds_profile_but_is_not_boosted_again(self) -> None:
        scorer = RecommendationScorer(
            ScoringConfig(interest_weight=0.2, behavior_weight=0.8)
        )
        ranked = scorer.rank(
            self.interests,
            self.stories,
            (ReadingBehavior(story_id=2, reading_completion_count=1),),
        )
        by_id = {item.story_id: item for item in ranked}

        self.assertEqual(ranked[0].story_id, 3)
        self.assertEqual(by_id[2].behavior_score, 0.0)
        self.assertAlmostEqual(by_id[3].behavior_score, 1.0)
        self.assertTrue(by_id[3].behavior_applied)

    def test_click_has_lower_confidence_than_completion(self) -> None:
        click_ranked = RecommendationScorer().rank(
            self.interests,
            self.stories,
            (ReadingBehavior(story_id=2, click_count=1),),
        )
        completion_ranked = RecommendationScorer().rank(
            self.interests,
            self.stories,
            (ReadingBehavior(story_id=2, reading_completion_count=1),),
        )
        click_candidate = next(item for item in click_ranked if item.story_id == 3)
        completion_candidate = next(
            item for item in completion_ranked if item.story_id == 3
        )

        self.assertAlmostEqual(click_candidate.behavior_score, 0.25)
        self.assertAlmostEqual(completion_candidate.behavior_score, 1.0)

    def test_old_behavior_decays_with_ninety_day_half_life(self) -> None:
        old_event = datetime.now(timezone.utc) - timedelta(days=90)
        ranked = RecommendationScorer().rank(
            self.interests,
            self.stories,
            (
                ReadingBehavior(
                    story_id=2,
                    reading_completion_count=1,
                    latest_positive_event_at=old_event,
                ),
            ),
        )
        candidate = next(item for item in ranked if item.story_id == 3)

        self.assertAlmostEqual(candidate.behavior_score, 0.5, places=3)

    def test_api_accepts_camel_case_behavior_contract_and_returns_components(self) -> None:
        store = MetadataEmbeddingStore(
            embedding_model="test",
            embedding_dimensions=2,
            stories=self.stories,
        )
        app = create_app(store=store, embedding_client=FakeEmbeddingClient())

        with TestClient(app) as client:
            response = client.post(
                "/recommendations",
                json={
                    "interests": ["동물"],
                    "languageCode": "ko",
                    "readingBehaviors": [
                        {
                            "originalStoryId": 2,
                            "exposureCount": 3,
                            "clickCount": 1,
                            "readingStartCount": 1,
                            "bodyCompletionCount": 1,
                            "readingCompletionCount": 1,
                            "latestPositiveEventAt": "2026-10-29T10:00:00+09:00",
                        }
                    ],
                },
            )

        self.assertEqual(response.status_code, 200)
        item = response.json()["recommendations"][0]
        self.assertIn("interestScore", item)
        self.assertIn("behaviorScore", item)
        self.assertTrue(item["behaviorApplied"])


if __name__ == "__main__":
    unittest.main()
