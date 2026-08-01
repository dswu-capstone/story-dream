"""Load and validate precomputed story metadata embeddings."""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path

from AI.recommendation_engine import MetadataVector, StoryCandidate


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_METADATA_PATH = PROJECT_ROOT / "data" / "generated_story_metadata.json"
DEFAULT_EMBEDDINGS_PATH = PROJECT_ROOT / "data" / "story_metadata_embeddings.json"
ARTIFACT_SCHEMA_VERSION = 1


@dataclass(frozen=True)
class MetadataEmbeddingStore:
    embedding_model: str
    embedding_dimensions: int
    source_sha256: str
    generated_at: str
    stories: tuple[StoryCandidate, ...]
    unique_text_count: int
    metadata_item_count: int

    @classmethod
    def load(
        cls,
        artifact_path: Path = DEFAULT_EMBEDDINGS_PATH,
        metadata_path: Path = DEFAULT_METADATA_PATH,
        *,
        verify_source: bool = True,
    ) -> "MetadataEmbeddingStore":
        try:
            payload = json.loads(artifact_path.read_text(encoding="utf-8"))
        except FileNotFoundError as error:
            raise RuntimeError(
                f"Metadata embedding artifact was not found: {artifact_path}."
            ) from error
        except json.JSONDecodeError as error:
            raise RuntimeError("Metadata embedding artifact is not valid JSON.") from error

        if payload.get("schemaVersion") != ARTIFACT_SCHEMA_VERSION:
            raise RuntimeError("Unsupported metadata embedding artifact schema.")

        source = payload.get("source") or {}
        source_sha256 = str(source.get("sha256") or "")
        if not source_sha256:
            raise RuntimeError("The artifact does not contain a metadata source hash.")
        if verify_source:
            current_hash = file_sha256(metadata_path)
            if current_hash != source_sha256:
                raise RuntimeError(
                    "Story metadata changed after embeddings were generated. "
                    "Regenerate the metadata embedding artifact."
                )

        embedding_info = payload.get("embedding") or {}
        embedding_model = str(embedding_info.get("model") or "").strip()
        embedding_dimensions = embedding_info.get("dimensions")
        if not embedding_model:
            raise RuntimeError("The artifact does not contain an embedding model.")
        if not isinstance(embedding_dimensions, int) or embedding_dimensions < 1:
            raise RuntimeError("The artifact contains invalid embedding dimensions.")

        raw_stories = payload.get("stories")
        if not isinstance(raw_stories, list) or not raw_stories:
            raise RuntimeError("The artifact does not contain any stories.")

        stories: list[StoryCandidate] = []
        seen_story_keys: set[tuple[str, int]] = set()
        metadata_item_count = 0
        unique_texts: set[str] = set()

        for raw_story in raw_stories:
            story_id = raw_story.get("originalStoryId")
            title = str(raw_story.get("title") or "").strip()
            language_code = str(raw_story.get("languageCode") or "").strip()
            if (
                isinstance(story_id, bool)
                or not isinstance(story_id, int)
                or story_id < 1
                or not title
                or not language_code
            ):
                raise RuntimeError("The artifact contains an invalid story.")
            story_key = (language_code, story_id)
            if story_key in seen_story_keys:
                raise RuntimeError(f"Duplicate story in artifact: {story_key}.")
            seen_story_keys.add(story_key)

            metadata: list[MetadataVector] = []
            for raw_metadata in raw_story.get("metadata") or []:
                text = str(raw_metadata.get("text") or "").strip()
                metadata_type = str(raw_metadata.get("metadataType") or "").upper()
                embedding = raw_metadata.get("embedding")
                if not text or metadata_type not in {"TAG", "THEME"}:
                    raise RuntimeError(
                        f"Story {story_id} contains invalid metadata fields."
                    )
                if not isinstance(embedding, list) or len(embedding) != embedding_dimensions:
                    raise RuntimeError(
                        f"Story {story_id} contains an invalid embedding dimension."
                    )
                if any(
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(value)
                    for value in embedding
                ):
                    raise RuntimeError(
                        f"Story {story_id} contains a non-finite embedding value."
                    )

                metadata.append(
                    MetadataVector(
                        text=text,
                        metadata_type=metadata_type,
                        embedding=tuple(float(value) for value in embedding),
                    )
                )
                unique_texts.add(text)
                metadata_item_count += 1

            if not metadata:
                raise RuntimeError(f"Story {story_id} has no embedded metadata.")
            stories.append(
                StoryCandidate(
                    story_id=story_id,
                    title=title,
                    language_code=language_code,
                    metadata=tuple(metadata),
                )
            )

        declared_story_count = payload.get("storyCount")
        declared_item_count = payload.get("metadataItemCount")
        declared_unique_count = payload.get("uniqueTextCount")
        if declared_story_count != len(stories):
            raise RuntimeError("The artifact story count is inconsistent.")
        if declared_item_count != metadata_item_count:
            raise RuntimeError("The artifact metadata item count is inconsistent.")
        if declared_unique_count != len(unique_texts):
            raise RuntimeError("The artifact unique text count is inconsistent.")

        return cls(
            embedding_model=embedding_model,
            embedding_dimensions=embedding_dimensions,
            source_sha256=source_sha256,
            generated_at=str(payload.get("generatedAt") or ""),
            stories=tuple(stories),
            unique_text_count=len(unique_texts),
            metadata_item_count=metadata_item_count,
        )

    def stories_for_language(self, language_code: str) -> tuple[StoryCandidate, ...]:
        return tuple(
            story
            for story in self.stories
            if story.language_code.casefold() == language_code.casefold()
        )


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()
