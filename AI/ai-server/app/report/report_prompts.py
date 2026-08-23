from __future__ import annotations

from app.report import trend_analyzer
from app.report.report_schemas import PeriodSummaryRequest, ReadingReportRequest

SYSTEM_PROMPT = """당신은 5~7세 아동의 독서 활동을 보호자에게 설명하는 교육 전문가입니다.

작성 규칙:
- 한국어 존댓말로, 보호자에게 이야기하듯 따뜻하게 씁니다.
- 반드시 2~3문장으로 씁니다. 그보다 길게 쓰지 마세요.
- 주어진 데이터에 없는 사실을 지어내지 마세요. 숫자를 추측하지 마세요.
- 아이를 평가하거나 다른 아이와 비교하지 말고, 관찰된 모습을 설명하고 격려하세요.
- 정답률이 낮거나 집중이 흐트러진 경우에도 부정적으로 단정하지 말고,
  다음에 도움이 될 만한 방향을 부드럽게 제안하세요.
- 마크다운, 목록, 제목을 쓰지 말고 평범한 문장만 출력하세요.
- 인사말이나 "다음은 요약입니다" 같은 사족 없이 본문만 출력하세요."""


def build_reading_report_prompt(req: ReadingReportRequest) -> str:
    accuracy_trend = trend_analyzer.analyze_accuracy_trend(req.parts)
    level_trend = trend_analyzer.analyze_level_trend(req.parts)

    part_lines = "\n".join(
        f"  - {p.part_type}: 레벨 {p.level}, 정답률 {p.accuracy:.0f}%, "
        f"집중 이탈 {p.distraction_count}회"
        for p in req.parts
    ) or "  - (구간 데이터 없음)"

    minutes = req.total_reading_sec // 60

    return f"""아래는 아이 한 명의 동화 한 편 독서 기록입니다. 이 내용을 보호자에게 2~3문장으로 설명해 주세요.

아이 이름: {req.child_name}
동화 제목: {req.story_title}
총 독서 시간: 약 {minutes}분
전체 평균 정답률: {req.average_quiz_score:.0f}%
전체 집중 이탈 횟수: {req.distraction_count}회

구간별 기록:
{part_lines}

이미 분석된 추세 (이 판단을 그대로 따르고, 다르게 해석하지 마세요):
- 정답률 추세: {accuracy_trend.direction} ({accuracy_trend.description})
- 난이도 추세: {level_trend.direction} ({level_trend.description})

첫 문장에서는 {req.child_name}(이)가 이 동화를 어떻게 읽었는지 전반적인 모습을 이야기하고,
이어지는 문장에서는 정답률이나 난이도 변화 중 가장 눈에 띄는 점을 언급해 주세요."""


def build_period_summary_prompt(req: PeriodSummaryRequest) -> str:
    weekly_trend = trend_analyzer.analyze_weekly_trend(req.weekly_scores)
    active_weeks, total_weeks = trend_analyzer.count_active_weeks(req.weekly_scores)

    weekly_lines = "\n".join(
        f"  - {w.label}: 독서 {w.reading_count}회, "
        + (
            f"평균 정답률 {w.average_quiz_score:.0f}%"
            if w.average_quiz_score is not None
            else "독서 없음"
        )
        for w in req.weekly_scores
    ) or "  - (주간 데이터 없음)"

    score_text = (
        f"{req.average_quiz_score:.0f}%" if req.average_quiz_score is not None else "데이터 없음"
    )
    focus_text = (
        f"{req.average_focus_rate:.0f}%" if req.average_focus_rate is not None else "데이터 없음"
    )

    return f"""아래는 아이 한 명의 일정 기간 독서 활동 요약입니다. 이 내용을 보호자에게 2~3문장으로 설명해 주세요.

아이 이름: {req.child_name}
조회 기간: {req.period_start} ~ {req.period_end}
기간 내 완료한 독서: 총 {req.total_reading_count}권
기간 평균 정답률: {score_text}
기간 평균 집중률: {focus_text}

주차별 기록:
{weekly_lines}

이미 분석된 추세 (이 판단을 그대로 따르고, 다르게 해석하지 마세요):
- 주간 정답률 추세: {weekly_trend.direction} ({weekly_trend.description})
- 독서 빈도: 전체 {total_weeks}주 중 {active_weeks}주에 독서함

첫 문장에서는 {req.child_name}(이)의 독서 습관과 꾸준함을 이야기하고,
이어지는 문장에서는 정답률 추세와 집중도에 대해 언급해 주세요."""