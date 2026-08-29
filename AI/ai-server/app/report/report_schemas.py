from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PartPayload(CamelModel):
    part_type: str = Field(..., description="서론 / 본론 / 결론")
    level: int = Field(..., ge=1, le=3)
    accuracy: float = Field(..., ge=0, le=100)
    distraction_count: int = Field(..., ge=0)


class ReadingReportRequest(CamelModel):
    child_name: str = Field(..., min_length=1, max_length=50)
    child_age_months: int = Field(..., ge=0, le=300)
    story_title: str = Field(..., min_length=1, max_length=255)
    total_reading_sec: int = Field(..., ge=0)
    average_quiz_score: float = Field(..., ge=0, le=100)
    distraction_count: int = Field(..., ge=0)
    start_level: int | None = None
    end_level: int | None = None
    parts: list[PartPayload] = Field(default_factory=list)

class WeeklyPayload(CamelModel):
    label: str
    reading_count: int = Field(..., ge=0)
    average_quiz_score: float | None = None


class PeriodSummaryRequest(CamelModel):
    child_name: str = Field(..., min_length=1, max_length=50)
    period_start: date
    period_end: date
    total_reading_count: int = Field(..., ge=0)
    average_quiz_score: float | None = None
    average_focus_rate: float | None = None
    weekly_scores: list[WeeklyPayload] = Field(default_factory=list)


class SummaryResponse(CamelModel):
    summary: str