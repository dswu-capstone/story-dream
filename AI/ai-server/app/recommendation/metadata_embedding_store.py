"""Load precomputed story metadata embeddings from JSON."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from app.recommendation.recommendation_engine import MetadataVector, StoryCandidate


RECOMMENDATION_ROOT = Path(__file__).resolve().parent
DEFAULT_EMBEDDINGS_PATH = (
    RECOMMENDATION_ROOT / "data" / "story_metadata_embeddings.json"
)


@dataclass(frozen=True)
class MetadataEmbeddingStore:
    embedding_model: str
    embedding_dimensions: int
    stories: tuple[StoryCandidate, ...]

    @classmethod
    def load(
        cls,
        artifact_path: Path = DEFAULT_EMBEDDINGS_PATH,
    ) -> "MetadataEmbeddingStore":
        try:
            payload = json.loads(artifact_path.read_text(encoding="utf-8"))
            embedding_info = payload["embedding"]
            stories = tuple(
                StoryCandidate(
                    story_id=story["originalStoryId"],
                    title=story["title"],
                    language_code=story["languageCode"],
                    metadata=tuple(
                        MetadataVector(
                            text=item["text"],
                            metadata_type=item["metadataType"],
                            embedding=tuple(item["embedding"]),
                        )
                        for item in story["metadata"]
                    ),
                )
                for story in payload["stories"]
            )
        except FileNotFoundError as error:
            raise RuntimeError(
                f"Metadata embedding file was not found: {artifact_path}."
            ) from error
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            raise RuntimeError(
                f"Metadata embedding file has an invalid format: {artifact_path}."
            ) from error

        return cls(
            embedding_model=embedding_info["model"],
            embedding_dimensions=embedding_info["dimensions"],
            stories=stories,
        )

    def stories_for_language(self, language_code: str) -> tuple[StoryCandidate, ...]:
        return tuple(
            story
            for story in self.stories
            if story.language_code.casefold() == language_code.casefold()
        )
