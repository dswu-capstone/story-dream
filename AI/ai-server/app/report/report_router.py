from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.recommendation.environment import DEFAULT_ENV_PATH, read_env_file
from app.report.chat_client import (
    DEFAULT_CHAT_MODEL,
    ChatCompletionError,
    OpenAIChatClient,
)
from app.report.report_schemas import (
    PeriodSummaryRequest,
    ReadingReportRequest,
    SummaryResponse,
)
from app.report.report_service import ReportService

logger = logging.getLogger(__name__)


def build_report_service() -> ReportService:
    env = {**read_env_file(DEFAULT_ENV_PATH), **os.environ}
    client = OpenAIChatClient(
        api_key=env.get("OPENAI_API_KEY", ""),
        model=env.get("REPORT_CHAT_MODEL", DEFAULT_CHAT_MODEL),
        timeout_seconds=float(env.get("REPORT_CHAT_TIMEOUT_SEC", "30")),
        max_retries=int(env.get("REPORT_CHAT_MAX_RETRIES", "2")),
    )
    return ReportService(
        client,
        enable_fallback=env.get("REPORT_FALLBACK", "1") != "0",
    )


async def verify_internal_key(x_api_key: str = Header(default="")) -> None:
    expected = {**read_env_file(DEFAULT_ENV_PATH), **os.environ}.get("INTERNAL_API_KEY", "")
    if not expected:
        return
    if x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 API 키입니다.",
        )


router = APIRouter(
    prefix="/ai/reading-report",
    tags=["reading-report"],
    dependencies=[Depends(verify_internal_key)],
)


@router.post("/summary", response_model=SummaryResponse, response_model_by_alias=True)
def create_reading_summary(payload: ReadingReportRequest, request: Request) -> SummaryResponse:
    service: ReportService = request.app.state.report_service
    try:
        return SummaryResponse(summary=service.summarize_reading(payload))
    except ChatCompletionError as error:
        logger.exception("리포트 요약 생성 실패")
        raise HTTPException(status_code=502, detail=str(error)) from None


@router.post("/period-summary", response_model=SummaryResponse, response_model_by_alias=True)
def create_period_summary(payload: PeriodSummaryRequest, request: Request) -> SummaryResponse:
    if payload.period_start > payload.period_end:
        raise HTTPException(status_code=400, detail="시작일이 종료일보다 늦을 수 없습니다.")

    service: ReportService = request.app.state.report_service
    try:
        return SummaryResponse(summary=service.summarize_period(payload))
    except ChatCompletionError as error:
        logger.exception("기간 요약 생성 실패")
        raise HTTPException(status_code=502, detail=str(error)) from None