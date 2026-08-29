# from fastapi import FastAPI
#
# app = FastAPI()
#
# @app.get("/")
# def read_root():
#   return {"Hello": "World!"}
#

import logging

from app.recommendation.recommendation_api import create_app
from app.report.report_router import build_report_service, router as report_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = create_app()
app.include_router(report_router)

app.state.report_service = build_report_service()