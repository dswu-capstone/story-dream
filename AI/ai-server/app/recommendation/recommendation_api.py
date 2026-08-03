"""FastAPI service for keyword-based story recommendations."""

from __future__ import annotations

import logging
import os
from collections.abc import Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated, Literal, Protocol

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.recommendation.embedding_client import (
    DEFAULT_EMBEDDING_URL,
    OpenAIEmbeddingClient,
)
from app.recommendation.environment import DEFAULT_ENV_PATH, read_env_file
from app.recommendation.interest_extractor import InterestPreprocessor
from app.recommendation.metadata_embedding_store import (
    DEFAULT_EMBEDDINGS_PATH,
    MetadataEmbeddingStore,
)
from app.recommendation.recommendation_engine import (
    InterestVector,
    RecommendationScorer,
    ScoredStory,
)


logger = logging.getLogger(__name__)


class EmbeddingClient(Protocol):
    def embed(self, texts: Sequence[str]) -> list[list[float]]: ...


@dataclass(frozen=True)
class ApiSettings:
    env_path: Path = DEFAULT_ENV_PATH
    embeddings_path: Path = DEFAULT_EMBEDDINGS_PATH


class RecommendationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    interests: Annotated[list[str], Field(min_length=1)]
    language_code: Literal["ko", "en"] = Field(default="ko", alias="languageCode")

    @field_validator("interests")
    @classmethod
    def normalize_interests(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            interest = " ".join(value.strip().split())
            if not interest:
                raise ValueError("Interests must not be blank.")
            if len(interest) > 200:
                raise ValueError("Each interest must be at most 200 characters.")
            key = interest.casefold()
            if key not in seen:
                seen.add(key)
                normalized.append(interest)
        return normalized


class StoryRecommendationResponse(BaseModel):
    original_story_id: int = Field(alias="originalStoryId")
    title: str
    language_code: str = Field(alias="languageCode")
    score: float


class RecommendationResponse(BaseModel):
    recommendations: list[StoryRecommendationResponse]


def create_app(
    *,
    settings: ApiSettings | None = None,
    store: MetadataEmbeddingStore | None = None,
    embedding_client: EmbeddingClient | None = None,
) -> FastAPI:
    resolved_settings = settings or ApiSettings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        resolved_store = store or MetadataEmbeddingStore.load(
            resolved_settings.embeddings_path,
        )
        env = (
            {**read_env_file(resolved_settings.env_path), **os.environ}
            if embedding_client is None
            else {}
        )
        if embedding_client is None:
            resolved_client: EmbeddingClient = OpenAIEmbeddingClient(
                api_key=env.get("OPENAI_API_KEY", ""),
                model=resolved_store.embedding_model,
                dimensions=(
                    resolved_store.embedding_dimensions
                    if resolved_store.embedding_model.startswith("text-embedding-3")
                    else None
                ),
                endpoint=env.get("OPENAI_EMBEDDING_URL", DEFAULT_EMBEDDING_URL),
            )
        else:
            resolved_client = embedding_client

        application.state.metadata_store = resolved_store
        application.state.embedding_client = resolved_client
        application.state.interest_preprocessor = InterestPreprocessor()
        yield

    application = FastAPI(
        title="Story Dream Recommendation API",
        version="1.0.0",
        lifespan=lifespan,
    )

    @application.get("/health")
    def health(request: Request) -> dict[str, object]:
        loaded_store: MetadataEmbeddingStore = request.app.state.metadata_store
        return {
            "status": "ok",
            "embeddingModel": loaded_store.embedding_model,
            "embeddingDimensions": loaded_store.embedding_dimensions,
            "storyCount": len(loaded_store.stories),
        }

    @application.post(
        "/recommendations",
        response_model=RecommendationResponse,
        response_model_by_alias=True,
    )
    def recommend(
        payload: RecommendationRequest,
        request: Request,
    ) -> RecommendationResponse:
        loaded_store: MetadataEmbeddingStore = request.app.state.metadata_store
        client: EmbeddingClient = request.app.state.embedding_client
        preprocessor: InterestPreprocessor = (
            request.app.state.interest_preprocessor
        )
        stories = loaded_store.stories_for_language(payload.language_code)
        if not stories:
            raise HTTPException(
                status_code=404,
                detail=f"No stories are available for {payload.language_code}.",
            )

        try:
            preprocessing = preprocessor.preprocess(payload.interests)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from None
        effective_interests = list(preprocessing.interests)

        try:
            embeddings = client.embed(effective_interests)
        except (RuntimeError, ValueError):
            logger.exception("Failed to generate interest embeddings.")
            raise HTTPException(
                status_code=502,
                detail="Failed to generate interest embeddings.",
            ) from None

        if len(embeddings) != len(effective_interests) or any(
            len(embedding) != loaded_store.embedding_dimensions
            for embedding in embeddings
        ):
            raise HTTPException(
                status_code=502,
                detail="Interest embedding dimensions do not match metadata.",
            )

        interest_vectors = [
            InterestVector(text=text, embedding=embedding)
            for text, embedding in zip(
                effective_interests,
                embeddings,
                strict=True,
            )
        ]
        ranked_stories = RecommendationScorer().rank(interest_vectors, stories)

        return RecommendationResponse(
            recommendations=[
                _serialize_story(story) for story in ranked_stories
            ]
        )

    return application


def _serialize_story(story: ScoredStory) -> StoryRecommendationResponse:
    return StoryRecommendationResponse(
        originalStoryId=story.story_id,
        title=story.title,
        languageCode=story.language_code,
        score=round(story.score, 6),
    )


app = create_app()
