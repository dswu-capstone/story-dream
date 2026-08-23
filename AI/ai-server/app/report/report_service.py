from __future__ import annotations

import logging

from app.report import trend_analyzer
from app.report.chat_client import ChatCompletionError, OpenAIChatClient
from app.report.report_prompts import (
    SYSTEM_PROMPT,
    build_period_summary_prompt,
    build_reading_report_prompt,
)
from app.report.report_schemas import PeriodSummaryRequest, ReadingReportRequest

logger = logging.getLogger(__name__)


class ReportService:
    def __init__(self, chat_client: OpenAIChatClient, *, enable_fallback: bool = True) -> None:
        self.chat_client = chat_client
        self.enable_fallback = enable_fallback

    def summarize_reading(self, req: ReadingReportRequest) -> str:
        try:
            return self.chat_client.complete(SYSTEM_PROMPT, build_reading_report_prompt(req))
        except ChatCompletionError:
            logger.exception("LLM 실패 (story=%s)", req.story_title)
            if self.enable_fallback:
                return _fallback_reading_summary(req)
            raise

    def summarize_period(self, req: PeriodSummaryRequest) -> str:
        try:
            return self.chat_client.complete(SYSTEM_PROMPT, build_period_summary_prompt(req))
        except ChatCompletionError:
            logger.exception("LLM 실패 (child=%s)", req.child_name)
            if self.enable_fallback:
                return _fallback_period_summary(req)
            raise


def _fallback_reading_summary(req: ReadingReportRequest) -> str:
    minutes = req.total_reading_sec // 60
    level_trend = trend_analyzer.analyze_level_trend(req.parts)

    first = (
        f"{req.child_name}(이)가 '{req.story_title}'을(를) 약 {minutes}분 동안 읽었어요. "
        f"퀴즈 평균 정답률은 {req.average_quiz_score:.0f}%였습니다."
    )
    if level_trend.direction == "상승":
        second = "이야기가 진행될수록 난이도를 올려서 읽을 수 있었어요."
    elif level_trend.direction == "하락":
        second = "중간에 난이도를 낮춰 편안하게 이야기를 따라갈 수 있도록 했어요."
    else:
        second = "처음부터 끝까지 안정적으로 이야기를 따라갔어요."
    return f"{first} {second}"


def _fallback_period_summary(req: PeriodSummaryRequest) -> str:
    active, total = trend_analyzer.count_active_weeks(req.weekly_scores)
    trend = trend_analyzer.analyze_weekly_trend(req.weekly_scores)

    first = f"{req.child_name}(이)는 이 기간 동안 {req.total_reading_count}권의 동화를 읽었어요."
    if total > 0 and active >= total * 0.7:
        first += " 꾸준히 독서하는 습관이 자리 잡고 있어요."

    if trend.direction == "상승":
        second = "정답률이 점점 좋아지는 모습을 보이고 있어요."
    elif trend.direction == "하락":
        second = "최근 정답률이 조금 낮아졌으니 함께 읽어주시면 도움이 될 거예요."
    elif trend.direction == "유지":
        second = "정답률이 안정적으로 유지되고 있어요."
    else:
        second = "이야기에 따라 이해도에 차이가 있는 모습이에요."
    return f"{first} {second}"