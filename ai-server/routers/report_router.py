"""
StoryDream AI 서버 - 독서 리포트 요약 엔드포인트

Spring은 '집계된 사실'만 보내고, 프롬프트와 모델 선택은 여기서 관리한다.
  POST /api/ai/reports/story   -> 동화 1권 리포트 요약   (화면3의 aiSummary)
  POST /api/ai/reports/period  -> 기간 전체 종합 분석     (화면2의 AI 종합 분석)

응답은 두 엔드포인트 모두 {"summary": "..."} 로 통일한다.
(Spring의 ReportAiClient가 이 형태를 기대한다. 실패하면 Spring이 규칙 기반 문구로 대체한다.)
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel

router = APIRouter(prefix="/api/ai/reports", tags=["reports"])

MODEL = "gpt-4o-mini"
_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI()
    return _client


SYSTEM_PROMPT = """당신은 5~7세 아동의 독서 기록을 보호자에게 설명해 주는 상담 도우미입니다.

규칙:
- 반드시 한국어 존댓말, 2~3문장, 120자 이내로 작성합니다.
- 주어진 수치 안에서만 이야기하고, 없는 사실을 지어내지 않습니다.
- 아이를 진단하거나 평가하지 않습니다. ('집중력이 부족합니다' 같은 표현 금지)
  대신 관찰된 사실과 다음에 해볼 만한 것을 부드럽게 제안합니다.
- 정답률이 낮거나 난이도가 내려간 경우에도 아이를 탓하지 않고 긍정적으로 표현합니다.
- 숫자를 나열하지 말고 흐름(올라감/내려감/유지)을 중심으로 설명합니다.
- 마크다운, 목록, 이모지를 쓰지 않고 평문으로만 작성합니다."""

class StoryPart(BaseModel):
    partType: str                       # 서론 / 본론 / 결론
    level: int                          # 1 ~ 3
    quizScore: float                    # 0 ~ 100
    quizCorrectCount: int
    quizTotalCount: int
    focusLossCount: Optional[int] = None


class StorySummaryRequest(BaseModel):
    childName: str
    childAge: Optional[int] = None
    storyTitle: str
    readingSeconds: int
    averageQuizScore: float
    focusLossCount: Optional[int] = None
    parts: List[StoryPart]


class Weekly(BaseModel):
    label: str
    averageQuizScore: Optional[float] = None
    readingCount: int


class PeriodSummaryRequest(BaseModel):
    childName: str
    childAge: Optional[int] = None
    periodStart: str
    periodEnd: str
    readingCount: int
    averageQuizScore: float
    totalReadingSeconds: int
    latestLevel: Optional[int] = None
    topStoryTitles: List[str] = []
    weeklyScores: List[Weekly] = []


class SummaryResponse(BaseModel):
    summary: str

def _complete(user_prompt: str) -> str:
    try:
        res = _get_client().chat.completions.create(
            model=MODEL,
            temperature=0.5,
            max_tokens=300,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        return res.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 호출 실패: {e}")

@router.post("/story", response_model=SummaryResponse)
def summarize_story(req: StorySummaryRequest) -> SummaryResponse:
    lines = [
        f"아이 이름: {req.childName}",
        f"동화 제목: {req.storyTitle}",
        f"총 독서 시간: {req.readingSeconds // 60}분 {req.readingSeconds % 60}초",
        f"전체 평균 정답률: {req.averageQuizScore:.0f}%",
    ]
    if req.childAge is not None:
        lines.insert(1, f"나이: 만 {req.childAge}세")
    if req.focusLossCount is not None:
        lines.append(f"화면 이탈 횟수: {req.focusLossCount}회")

    lines.append("문단별 기록 (난이도 1이 가장 쉬움, 3이 가장 어려움):")
    for p in req.parts:
        row = (
            f"- {p.partType}: 난이도 {p.level}, "
            f"정답률 {p.quizScore:.0f}% ({p.quizCorrectCount}/{p.quizTotalCount})"
        )
        if p.focusLossCount is not None:
            row += f", 이탈 {p.focusLossCount}회"
        lines.append(row)

    lines.append(
        "\n위 기록으로 보호자가 읽을 요약을 작성해 주세요. "
        "정답률의 흐름과 난이도 변화를 함께 언급하고, 마지막에 다음 독서에 대한 짧은 제안을 덧붙여 주세요."
    )
    return SummaryResponse(summary=_complete("\n".join(lines)))


@router.post("/period", response_model=SummaryResponse)
def summarize_period(req: PeriodSummaryRequest) -> SummaryResponse:
    if req.readingCount == 0:
        return SummaryResponse(summary="이 기간에는 완료한 독서 기록이 없어요.")

    lines = [
        f"아이 이름: {req.childName}",
        f"기간: {req.periodStart} ~ {req.periodEnd}",
        f"완독한 동화 수: {req.readingCount}권",
        f"기간 평균 정답률: {req.averageQuizScore:.0f}%",
        f"총 독서 시간: {req.totalReadingSeconds // 60}분",
    ]
    if req.latestLevel is not None:
        lines.append(f"최근 난이도: 레벨 {req.latestLevel}")
    if req.topStoryTitles:
        lines.append(f"읽은 동화: {', '.join(req.topStoryTitles)}")

    lines.append("주차별 평균 정답률:")
    for w in req.weeklyScores:
        if w.averageQuizScore is None:
            lines.append(f"- {w.label}: 기록 없음")
        else:
            lines.append(f"- {w.label}: {w.averageQuizScore:.0f}% ({w.readingCount}권)")

    lines.append(
        "\n위 기록으로 보호자가 읽을 종합 분석을 작성해 주세요. "
        "주차별 정답률의 추세(오름/내림/유지)와 독서의 꾸준함을 중심으로 설명해 주세요."
    )
    return SummaryResponse(summary=_complete("\n".join(lines)))