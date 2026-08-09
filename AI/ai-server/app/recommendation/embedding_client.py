"""Small OpenAI embeddings client shared by batch jobs and the API server."""

from __future__ import annotations

import json
from collections.abc import Sequence
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_EMBEDDING_URL = "https://api.openai.com/v1/embeddings"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"


class OpenAIEmbeddingClient:
    """Call the OpenAI embeddings endpoint in bounded batches."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_EMBEDDING_MODEL,
        *,
        dimensions: int | None = None,
        endpoint: str = DEFAULT_EMBEDDING_URL,
        timeout_seconds: float = 60.0,
        batch_size: int = 256,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required.")
        if not model:
            raise ValueError("An embedding model is required.")
        if dimensions is not None and dimensions < 1:
            raise ValueError("dimensions must be at least 1.")
        if batch_size < 1:
            raise ValueError("batch_size must be at least 1.")

        self.api_key = api_key
        self.model = model
        self.dimensions = dimensions
        self.endpoint = endpoint
        self.timeout_seconds = timeout_seconds
        self.batch_size = batch_size

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        if any(not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError("Embedding inputs must be non-empty strings.")

        embeddings: list[list[float]] = []
        for start in range(0, len(texts), self.batch_size):
            embeddings.extend(self._embed_batch(texts[start : start + self.batch_size]))
        return embeddings

    def _embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        request_body: dict[str, object] = {
            "model": self.model,
            "input": list(texts),
        }
        if self.dimensions is not None:
            request_body["dimensions"] = self.dimensions

        request = Request(
            self.endpoint,
            data=json.dumps(request_body, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )

        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                response_payload = json.load(response)
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Embedding request failed with status {error.code}: {detail}"
            ) from error
        except URLError as error:
            raise RuntimeError(f"Embedding request failed: {error.reason}") from error

        data = sorted(response_payload.get("data", []), key=lambda item: item["index"])
        if len(data) != len(texts):
            raise RuntimeError("Embedding response count does not match the request.")

        embeddings = [item["embedding"] for item in data]
        expected_dimensions = self.dimensions or len(embeddings[0])
        if any(len(embedding) != expected_dimensions for embedding in embeddings):
            raise RuntimeError("Embedding response dimensions are inconsistent.")
        return embeddings

