"""Small OpenAI chat-completions client for reading-report summaries."""

from __future__ import annotations

import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_CHAT_MODEL = "gpt-4o-mini"


class ChatCompletionError(RuntimeError):
    """LLM 호출 실패 또는 빈 응답."""


class OpenAIChatClient:
    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_CHAT_MODEL,
        *,
        endpoint: str = DEFAULT_CHAT_URL,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
        temperature: float = 0.7,
        max_tokens: int = 300,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required.")
        self.api_key = api_key
        self.model = model
        self.endpoint = endpoint
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.temperature = temperature
        self.max_tokens = max_tokens

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        last_error: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                return self._call(system_prompt, user_prompt)
            except ChatCompletionError:
                raise                       # 빈 응답은 재시도해도 소용없음
            except (HTTPError, URLError, TimeoutError, OSError) as error:
                last_error = error
                if attempt < self.max_retries:
                    time.sleep(2**attempt)  # 1s, 2s

        raise ChatCompletionError(f"Chat completion failed: {last_error}")

    def _call(self, system_prompt: str, user_prompt: str) -> str:
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

        request = Request(
            self.endpoint,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )

        with urlopen(request, timeout=self.timeout_seconds) as response:
            payload = json.load(response)

        choices = payload.get("choices") or []
        if not choices:
            raise ChatCompletionError("Chat response contained no choices.")

        content = (choices[0].get("message") or {}).get("content") or ""
        text = content.strip()
        if not text:
            raise ChatCompletionError("Chat response was empty.")
        return text