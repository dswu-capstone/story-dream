"""Embedding-based story recommendation scoring.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Sequence

@dataclass(frozen=True)
class ScoringConfig:
    """Tunable scoring parameters.

    ``min_match_score`` is applied after metadata weighting and exact-match
    boosting. The defaults match the existing recommendation experiments while
    rejecting weak semantic associations.
    """

    min_match_score: float = 0.50
    tag_weight: float = 0.85
    theme_weight: float = 0.90
    exact_match_boost: float = 0.15
    primary_match_weight: float = 0.70
    secondary_match_weight: float = 0.30
    base_coverage_factor: float = 0.70
    coverage_factor_weight: float = 0.30

    def __post_init__(self) -> None:
        bounded_values = (
            self.min_match_score,
            self.tag_weight,
            self.theme_weight,
            self.exact_match_boost,
            self.primary_match_weight,
            self.secondary_match_weight,
            self.base_coverage_factor,
            self.coverage_factor_weight,
        )
        if any(value < 0 or value > 1 for value in bounded_values):
            raise ValueError("Scoring parameters must be between 0 and 1.")
        if not _approximately_one(
            self.primary_match_weight + self.secondary_match_weight
        ):
            raise ValueError("Primary and secondary match weights must sum to 1.")
        if not _approximately_one(
            self.base_coverage_factor + self.coverage_factor_weight
        ):
            raise ValueError("Coverage factors must sum to 1.")


@dataclass(frozen=True)
class InterestVector:
    text: str
    embedding: Sequence[float]


@dataclass(frozen=True)
class MetadataVector:
    text: str
    metadata_type: str
    embedding: Sequence[float]

    def __post_init__(self) -> None:
        normalized_type = self.metadata_type.upper()
        if normalized_type not in {"TAG", "THEME"}:
            raise ValueError("metadata_type must be TAG or THEME.")
        object.__setattr__(self, "metadata_type", normalized_type)


@dataclass(frozen=True)
class StoryCandidate:
    story_id: int
    title: str
    language_code: str
    metadata: Sequence[MetadataVector]


@dataclass(frozen=True)
class InterestMatch:
    interest: str
    metadata_text: str
    metadata_type: str
    raw_similarity: float
    score: float
    exact_match: bool


@dataclass(frozen=True)
class ScoredStory:
    story_id: int
    title: str
    language_code: str
    score: float
    coverage: float
    matches: tuple[InterestMatch, ...]
    unmatched_interests: tuple[str, ...]
    tags: tuple[str, ...] = ()


class RecommendationScorer:
    """Scores stories with thresholded, one-to-one semantic matching."""

    def __init__(self, config: ScoringConfig | None = None) -> None:
        self.config = config or ScoringConfig()

    def rank(
        self,
        interests: Sequence[InterestVector],
        stories: Sequence[StoryCandidate],
    ) -> list[ScoredStory]:
        unique_interests = self._deduplicate_interests(interests)
        if not unique_interests:
            return []

        scored_stories = [
            self._score_story(unique_interests, story) for story in stories
        ]
        return sorted(
            scored_stories,
            key=lambda item: (-item.score, item.story_id),
        )

    def _score_story(
        self,
        interests: Sequence[InterestVector],
        story: StoryCandidate,
    ) -> ScoredStory:
        metadata = self._deduplicate_metadata(story.metadata)
        if not metadata:
            return self._empty_result(story, interests)

        match_details: list[list[InterestMatch | None]] = []
        effective_scores: list[list[float]] = []

        for interest in interests:
            detail_row: list[InterestMatch | None] = []
            score_row: list[float] = []

            for metadata_item in metadata:
                match = self._calculate_match(interest, metadata_item)
                if match.score >= self.config.min_match_score:
                    detail_row.append(match)
                    score_row.append(match.score)
                else:
                    detail_row.append(None)
                    score_row.append(0.0)

            match_details.append(detail_row)
            effective_scores.append(score_row)

        metadata_assignment = _maximum_weight_matching(effective_scores)
        matches: list[InterestMatch] = []
        unmatched_interests: list[str] = []

        for interest_index, metadata_index in enumerate(metadata_assignment):
            if metadata_index < 0:
                unmatched_interests.append(interests[interest_index].text)
                continue

            match = match_details[interest_index][metadata_index]
            if match is None:
                unmatched_interests.append(interests[interest_index].text)
                continue

            matches.append(match)

        if not matches:
            return self._empty_result(story, interests)

        matches.sort(key=lambda item: item.score, reverse=True)
        coverage = len(matches) / len(interests)
        focused_score = matches[0].score

        if len(interests) > 1:
            secondary_score = matches[1].score if len(matches) > 1 else 0.0
            focused_score = (
                matches[0].score * self.config.primary_match_weight
                + secondary_score * self.config.secondary_match_weight
            )

        coverage_factor = (
            self.config.base_coverage_factor
            + coverage * self.config.coverage_factor_weight
        )

        return ScoredStory(
            story_id=story.story_id,
            title=story.title,
            language_code=story.language_code,
            score=min(1.0, focused_score * coverage_factor),
            coverage=coverage,
            matches=tuple(matches),
            unmatched_interests=tuple(unmatched_interests),
            tags=self._story_tags(story),
        )

    def _calculate_match(
        self,
        interest: InterestVector,
        metadata: MetadataVector,
    ) -> InterestMatch:
        raw_similarity = cosine_similarity(
            interest.embedding,
            metadata.embedding,
        )
        metadata_weight = self._metadata_weight(metadata)
        exact_match = _normalize_text(interest.text) == _normalize_text(metadata.text)
        score = raw_similarity * metadata_weight

        if exact_match:
            score += self.config.exact_match_boost

        return InterestMatch(
            interest=interest.text,
            metadata_text=metadata.text,
            metadata_type=metadata.metadata_type,
            raw_similarity=raw_similarity,
            score=min(1.0, score),
            exact_match=exact_match,
        )

    def _metadata_weight(self, metadata: MetadataVector) -> float:
        if metadata.metadata_type == "THEME":
            return self.config.theme_weight
        return self.config.tag_weight

    def _deduplicate_interests(
        self,
        interests: Sequence[InterestVector],
    ) -> list[InterestVector]:
        unique: dict[str, InterestVector] = {}
        for interest in interests:
            normalized_text = _normalize_text(interest.text)
            if normalized_text:
                unique.setdefault(normalized_text, interest)
        return list(unique.values())

    def _deduplicate_metadata(
        self,
        metadata: Sequence[MetadataVector],
    ) -> list[MetadataVector]:
        unique: dict[str, MetadataVector] = {}
        for item in metadata:
            normalized_text = _normalize_text(item.text)
            if not normalized_text:
                continue

            existing = unique.get(normalized_text)
            if existing is None or self._metadata_weight(item) > self._metadata_weight(
                existing
            ):
                unique[normalized_text] = item
        return list(unique.values())

    def _empty_result(
        self,
        story: StoryCandidate,
        interests: Sequence[InterestVector],
    ) -> ScoredStory:
        return ScoredStory(
            story_id=story.story_id,
            title=story.title,
            language_code=story.language_code,
            score=0.0,
            coverage=0.0,
            matches=(),
            unmatched_interests=tuple(interest.text for interest in interests),
            tags=self._story_tags(story),
        )

    def _story_tags(self, story: StoryCandidate) -> tuple[str, ...]:
        return tuple(
            item.text
            for item in self._deduplicate_metadata(story.metadata)
            if item.metadata_type == "TAG"
        )


def cosine_similarity(
    first: Sequence[float],
    second: Sequence[float],
) -> float:
    if len(first) != len(second):
        raise ValueError("Embedding dimensions do not match.")
    if not first:
        return 0.0

    dot_product = sum(a * b for a, b in zip(first, second, strict=True))
    first_norm = sqrt(sum(value * value for value in first))
    second_norm = sqrt(sum(value * value for value in second))

    if first_norm == 0 or second_norm == 0:
        return 0.0
    return dot_product / (first_norm * second_norm)


def _maximum_weight_matching(weights: Sequence[Sequence[float]]) -> list[int]:
    """Return an optimal row-to-column assignment using the Hungarian method.

    Real metadata columns can be used only once. Zero-weight dummy columns allow
    interests without a sufficiently strong metadata match to remain unmatched.
    """

    row_count = len(weights)
    if row_count == 0:
        return []

    real_column_count = len(weights[0])
    if real_column_count == 0:
        return [-1] * row_count
    if any(len(row) != real_column_count for row in weights):
        raise ValueError("The matching matrix must be rectangular.")

    column_count = real_column_count + row_count
    row_potential = [0.0] * (row_count + 1)
    column_potential = [0.0] * (column_count + 1)
    matched_row_by_column = [0] * (column_count + 1)
    previous_column = [0] * (column_count + 1)

    for row in range(1, row_count + 1):
        matched_row_by_column[0] = row
        current_column = 0
        minimum_reduced_cost = [float("inf")] * (column_count + 1)
        used_column = [False] * (column_count + 1)

        while True:
            used_column[current_column] = True
            current_row = matched_row_by_column[current_column]
            delta = float("inf")
            next_column = 0

            for column in range(1, column_count + 1):
                if used_column[column]:
                    continue

                weight = (
                    weights[current_row - 1][column - 1]
                    if column <= real_column_count
                    else 0.0
                )
                reduced_cost = (
                    -weight
                    - row_potential[current_row]
                    - column_potential[column]
                )

                if reduced_cost < minimum_reduced_cost[column]:
                    minimum_reduced_cost[column] = reduced_cost
                    previous_column[column] = current_column

                if minimum_reduced_cost[column] < delta:
                    delta = minimum_reduced_cost[column]
                    next_column = column

            for column in range(column_count + 1):
                if used_column[column]:
                    row_potential[matched_row_by_column[column]] += delta
                    column_potential[column] -= delta
                else:
                    minimum_reduced_cost[column] -= delta

            current_column = next_column
            if matched_row_by_column[current_column] == 0:
                break

        while True:
            next_column = previous_column[current_column]
            matched_row_by_column[current_column] = matched_row_by_column[next_column]
            current_column = next_column
            if current_column == 0:
                break

    column_by_row = [-1] * row_count
    for column in range(1, real_column_count + 1):
        row = matched_row_by_column[column]
        if row > 0 and weights[row - 1][column - 1] > 0:
            column_by_row[row - 1] = column - 1
    return column_by_row


def _normalize_text(text: str) -> str:
    return " ".join(text.strip().casefold().split())


def _approximately_one(value: float) -> bool:
    return abs(value - 1.0) < 1e-9
