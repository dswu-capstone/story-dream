"""Normalize short interest keywords."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Sequence


MIN_INTERESTS = 1
MAX_INTEREST_LENGTH = 30


@dataclass(frozen=True)
class InterestPreprocessingResult:
    """The original input and the keyword list used for recommendation."""

    input_interests: tuple[str, ...]
    interests: tuple[str, ...]
    status: Literal["not_needed", "applied"]
    extraction_model: None = None

    @property
    def extraction_applied(self) -> bool:

        return self.status == "applied"


class InterestPreprocessor:

    def preprocess(
        self,
        interests: Sequence[str] | str,
    ) -> InterestPreprocessingResult:
        input_interests = tuple(_normalize_input_values(interests))
        normalized = tuple(normalize_interests(input_interests))
        validate_interests(normalized)

        return InterestPreprocessingResult(
            input_interests=input_interests,
            interests=normalized,
            status=("not_needed" if normalized == input_interests else "applied"),
        )


def normalize_interests(values: Sequence[str] | str) -> list[str]:
    """Return unique keywords after splitting comma-delimited input."""

    normalized: list[str] = []
    seen: set[str] = set()

    for value in _as_sequence(values):
        # Accept the common ASCII comma and the full-width comma used by some IMEs.
        for part in str(value).replace("，", ",").split(","):
            interest = " ".join(part.strip().split())
            key = interest.casefold()
            if interest and key not in seen:
                seen.add(key)
                normalized.append(interest)

    return normalized


def validate_interests(interests: Sequence[str]) -> None:
    """Require at least one keyword and validate individual keyword length."""

    if len(interests) < MIN_INTERESTS:
        raise ValueError("Interests must contain at least one keyword.")

    if any(len(interest) > MAX_INTEREST_LENGTH for interest in interests):
        raise ValueError(
            f"Each interest must be at most {MAX_INTEREST_LENGTH} characters."
        )


def _normalize_input_values(values: Sequence[str] | str) -> list[str]:
    return [
        normalized
        for value in _as_sequence(values)
        if (normalized := " ".join(str(value).strip().split()))
    ]


def _as_sequence(values: Sequence[str] | str) -> Sequence[str]:
    return [values] if isinstance(values, str) else values
