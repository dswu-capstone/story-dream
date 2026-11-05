from __future__ import annotations

import unittest
from pathlib import Path

from app.recommendation.offline_evaluator import (
    evaluate_cases,
    evaluate_ranking,
    load_cases,
)


FIXTURE = Path(__file__).parent / "fixtures" / "virtual_behavior_eval.json"


class OfflineEvaluatorTest(unittest.TestCase):
    def test_ranking_metrics(self) -> None:
        result = evaluate_ranking([3, 1, 2], {2, 3}, 3)

        self.assertAlmostEqual(result.recall, 1.0)
        self.assertAlmostEqual(result.mrr, 1.0)
        self.assertAlmostEqual(result.hit_rate, 1.0)
        self.assertGreater(result.ndcg, 0.9)

    def test_virtual_behavior_fixture_compares_both_rankings(self) -> None:
        summary = evaluate_cases(load_cases(FIXTURE), k=3)

        self.assertEqual(summary.case_count, 3)
        self.assertGreaterEqual(summary.behavior_aware.ndcg, summary.interest_only.ndcg)
        self.assertGreaterEqual(summary.behavior_aware.recall, summary.interest_only.recall)
        self.assertEqual(
            summary.improved_cases + summary.tied_cases + summary.degraded_cases,
            3,
        )

    def test_empty_dataset_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            evaluate_cases([], k=5)


if __name__ == "__main__":
    unittest.main()
