from __future__ import annotations

from dataclasses import dataclass

from app.report.report_schemas import PartPayload, WeeklyPayload


@dataclass(frozen=True)
class TrendResult:
    direction: str
    description: str


def _classify(values: list[float], threshold: float = 5.0) -> TrendResult:
    if len(values) < 2:
        return TrendResult("데이터부족", "추세를 판단할 데이터가 부족합니다.")

    delta = values[-1] - values[0]
    swing = max(values) - min(values)

    if abs(delta) < threshold and swing < threshold * 2:
        return TrendResult("유지", "전반적으로 비슷한 수준을 유지했습니다.")
    if abs(delta) < threshold:
        return TrendResult("변동", "구간에 따라 오르내림이 있었습니다.")
    if delta > 0:
        return TrendResult("상승", f"처음보다 {delta:.0f}점 올랐습니다.")
    return TrendResult("하락", f"처음보다 {abs(delta):.0f}점 내려갔습니다.")


def analyze_accuracy_trend(parts: list[PartPayload]) -> TrendResult:
    return _classify([p.accuracy for p in parts])


def analyze_level_trend(parts: list[PartPayload]) -> TrendResult:
    levels = [p.level for p in parts]
    if len(levels) < 2:
        return TrendResult("데이터부족", "난이도 변화를 판단할 데이터가 부족합니다.")

    if levels[0] == levels[-1]:
        if len(set(levels)) == 1:
            return TrendResult("유지", f"레벨 {levels[0]}로 끝까지 진행했습니다.")
        return TrendResult("변동", "중간에 난이도가 조정되었다가 원래 수준으로 돌아왔습니다.")
    if levels[-1] > levels[0]:
        return TrendResult("상승", f"레벨 {levels[0]}에서 레벨 {levels[-1]}로 올라갔습니다.")
    return TrendResult("하락", f"레벨 {levels[0]}에서 레벨 {levels[-1]}로 낮춰 진행했습니다.")


def analyze_weekly_trend(weekly: list[WeeklyPayload]) -> TrendResult:
    values = [w.average_quiz_score for w in weekly if w.average_quiz_score is not None]
    return _classify(values)


def count_active_weeks(weekly: list[WeeklyPayload]) -> tuple[int, int]:
    active = sum(1 for w in weekly if w.reading_count > 0)
    return active, len(weekly)