from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from routers.report_router import router as report_router

app = FastAPI(
    title="StoryDream AI Server",
    description="동화 생성 / 퀴즈 / 독서 리포트 요약",
)

app.include_router(report_router)


@app.get("/health")
def health():
    """Spring 쪽에서 AI 서버가 살아있는지 확인용"""
    return {"status": "ok"}