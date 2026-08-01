"""Extract compact story interests from a long free-text preference."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal, Protocol, Sequence

from openai import OpenAI
from pydantic import BaseModel, Field


DEFAULT_INTEREST_EXTRACTION_MODEL = "gpt-5.6-luna"
MIN_EXTRACTED_INTERESTS = 3
MAX_EXTRACTED_INTERESTS = 5

logger = logging.getLogger(__name__)


class ExtractedInterests(BaseModel):
    interests: list[str] = Field(
        min_length=MIN_EXTRACTED_INTERESTS,
        max_length=MAX_EXTRACTED_INTERESTS,
    )


class InterestExtractor(Protocol):
    model: str

    def extract(self, text: str, language_code: str) -> list[str]: ...


@dataclass(frozen=True)
class InterestPreprocessingResult:
    input_interests: tuple[str, ...]
    interests: tuple[str, ...]
    status: Literal["not_needed", "applied", "fallback"]
    extraction_model: str | None

    @property
    def extraction_applied(self) -> bool:
        return self.status == "applied"


class OpenAIInterestExtractor:
    """Use Structured Outputs to turn one rich sentence into 3-5 concepts."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_INTEREST_EXTRACTION_MODEL,
        *,
        base_url: str | None = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required.")
        if not model:
            raise ValueError("An interest extraction model is required.")

        client_options: dict[str, object] = {
            "api_key": api_key,
            "timeout": timeout_seconds,
            "max_retries": 1,
        }
        if base_url:
            client_options["base_url"] = base_url

        self.model = model
        self._client = OpenAI(**client_options)

    def extract(self, text: str, language_code: str) -> list[str]:
        language_instruction = (
            "Write every extracted interest in Korean."
            if language_code.casefold() == "ko"
            else "Write every extracted interest in English."
        )
        response = self._client.responses.parse(
            model=self.model,
            instructions=(
                "Extract exactly 3 to 5 distinct interests that are useful for "
                "recommending a children's story. Extract concrete characters, "
                "world elements, activities, relationships, emotions, or themes "
                "that are supported by the user's text. Keep each interest short "
                "(normally 1 to 5 words), preserve the user's meaning, avoid "
                "generic words such as story or fairy tale, and do not invent "
                f"unsupported preferences. {language_instruction}"
            ),
            input=text,
            text_format=ExtractedInterests,
            reasoning={"effort": "low"},
            max_output_tokens=200,
            store=False,
        )
        parsed = response.output_parsed
        if parsed is None:
            raise RuntimeError("Interest extraction returned no structured output.")

        interests = normalize_interests(parsed.interests)
        if not MIN_EXTRACTED_INTERESTS <= len(interests) <= MAX_EXTRACTED_INTERESTS:
            raise RuntimeError("Interest extraction returned an invalid item count.")
        if any(len(interest) > 80 for interest in interests):
            raise RuntimeError("An extracted interest is too long.")
        return interests


class InterestPreprocessor:
    """Apply extraction only when one input looks like a rich free-text sentence."""

    def __init__(self, extractor: InterestExtractor) -> None:
        self.extractor = extractor

    def preprocess(
        self,
        interests: Sequence[str],
        language_code: str,
    ) -> InterestPreprocessingResult:
        normalized = tuple(normalize_interests(interests))
        if not should_extract_interests(normalized):
            return InterestPreprocessingResult(
                input_interests=normalized,
                interests=normalized,
                status="not_needed",
                extraction_model=None,
            )

        try:
            extracted = tuple(self.extractor.extract(normalized[0], language_code))
        except Exception:
            logger.exception(
                "Interest extraction failed; falling back to the original input."
            )
            return InterestPreprocessingResult(
                input_interests=normalized,
                interests=normalized,
                status="fallback",
                extraction_model=self.extractor.model,
            )

        return InterestPreprocessingResult(
            input_interests=normalized,
            interests=extracted,
            status="applied",
            extraction_model=self.extractor.model,
        )


def should_extract_interests(interests: Sequence[str]) -> bool:
    if len(interests) != 1:
        return False

    text = interests[0]
    word_count = len(text.split())
    compact_length = len("".join(text.split()))
    sentence_markers = (
        "이야기",
        "동화",
        "나오는",
        "등장하는",
        "좋아",
        "원해",
        "보고 싶",
        "story",
        "about",
        "with",
        "where",
        "featuring",
    )
    normalized = text.casefold()
    return (
        compact_length >= 18
        or word_count >= 6
        or (
            compact_length >= 12
            and any(marker in normalized for marker in sentence_markers)
        )
    )


def normalize_interests(values: Sequence[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        interest = " ".join(str(value).strip().split())
        key = interest.casefold()
        if interest and key not in seen:
            seen.add(key)
            normalized.append(interest)
    return normalized

