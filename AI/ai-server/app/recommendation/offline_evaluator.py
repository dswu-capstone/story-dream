"""Offline comparison of interest-only and behavior-aware rankings."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from math import log2
from pathlib import Path
from typing import Any, Sequence


@dataclass(frozen=True)
class RankingMetrics:
    ndcg: float
    recall: float
    mrr: float
    hit_rate: float


@dataclass(frozen=True)
class EvaluationSummary:
    case_count: int
    k: int
    interest_only: RankingMetrics
    behavior_aware: RankingMetrics
    ndcg_lift: float
    recall_lift: float
    mrr_lift: float
    improved_cases: int
    tied_cases: int
    degraded_cases: int


def evaluate_cases(cases: Sequence[dict[str, Any]], k: int = 5) -> EvaluationSummary:
    if k <= 0:
        raise ValueError("k must be positive.")
    if not cases:
        raise ValueError("At least one evaluation case is required.")

    interest_metrics: list[RankingMetrics] = []
    behavior_metrics: list[RankingMetrics] = []
    improved = tied = degraded = 0

    for case in cases:
        relevant = _positive_story_ids(case)
        candidates = _validated_candidates(case)
        interest_ranking = _rank(candidates, "interestScore")
        behavior_ranking = _rank(candidates, "score")
        interest_result = evaluate_ranking(interest_ranking, relevant, k)
        behavior_result = evaluate_ranking(behavior_ranking, relevant, k)
        interest_metrics.append(interest_result)
        behavior_metrics.append(behavior_result)

        difference = behavior_result.ndcg - interest_result.ndcg
        if difference > 1e-12:
            improved += 1
        elif difference < -1e-12:
            degraded += 1
        else:
            tied += 1

    interest_average = _average(interest_metrics)
    behavior_average = _average(behavior_metrics)
    return EvaluationSummary(
        case_count=len(cases),
        k=k,
        interest_only=interest_average,
        behavior_aware=behavior_average,
        ndcg_lift=behavior_average.ndcg - interest_average.ndcg,
        recall_lift=behavior_average.recall - interest_average.recall,
        mrr_lift=behavior_average.mrr - interest_average.mrr,
        improved_cases=improved,
        tied_cases=tied,
        degraded_cases=degraded,
    )


def evaluate_ranking(
    ranked_story_ids: Sequence[int],
    relevant_story_ids: set[int],
    k: int,
) -> RankingMetrics:
    top_k = list(ranked_story_ids[:k])
    relevance = [1 if story_id in relevant_story_ids else 0 for story_id in top_k]
    dcg = sum(value / log2(rank + 2) for rank, value in enumerate(relevance))
    ideal_count = min(len(relevant_story_ids), k)
    ideal_dcg = sum(1 / log2(rank + 2) for rank in range(ideal_count))
    hits = sum(relevance)
    reciprocal_rank = next(
        (1 / (rank + 1) for rank, value in enumerate(relevance) if value),
        0.0,
    )
    return RankingMetrics(
        ndcg=dcg / ideal_dcg if ideal_dcg else 0.0,
        recall=hits / len(relevant_story_ids),
        mrr=reciprocal_rank,
        hit_rate=1.0 if hits else 0.0,
    )


def summary_to_dict(summary: EvaluationSummary) -> dict[str, Any]:
    payload = asdict(summary)
    return _round_floats(payload)


def load_cases(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    cases = payload.get("cases")
    if not isinstance(cases, list):
        raise ValueError("Input JSON must contain a cases array.")
    return cases


def _positive_story_ids(case: dict[str, Any]) -> set[int]:
    values = case.get("heldOutPositiveStoryIds")
    if not isinstance(values, list) or not values:
        raise ValueError("Each case needs non-empty heldOutPositiveStoryIds.")
    story_ids = {int(value) for value in values}
    if any(story_id <= 0 for story_id in story_ids):
        raise ValueError("Story IDs must be positive.")
    return story_ids


def _validated_candidates(case: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = case.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("Each case needs a non-empty candidates array.")
    story_ids = [int(candidate["originalStoryId"]) for candidate in candidates]
    if len(story_ids) != len(set(story_ids)):
        raise ValueError("Candidate story IDs must be unique within a case.")
    for candidate in candidates:
        float(candidate["interestScore"])
        float(candidate["score"])
    return candidates


def _rank(candidates: Sequence[dict[str, Any]], score_field: str) -> list[int]:
    return [
        int(candidate["originalStoryId"])
        for candidate in sorted(
            candidates,
            key=lambda item: (-float(item[score_field]), int(item["originalStoryId"])),
        )
    ]


def _average(metrics: Sequence[RankingMetrics]) -> RankingMetrics:
    count = len(metrics)
    return RankingMetrics(
        ndcg=sum(item.ndcg for item in metrics) / count,
        recall=sum(item.recall for item in metrics) / count,
        mrr=sum(item.mrr for item in metrics) / count,
        hit_rate=sum(item.hit_rate for item in metrics) / count,
    )


def _round_floats(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, dict):
        return {key: _round_floats(item) for key, item in value.items()}
    return value


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare interest-only and behavior-aware recommendation rankings."
    )
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()
    summary = evaluate_cases(load_cases(args.input), args.k)
    print(json.dumps(summary_to_dict(summary), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
