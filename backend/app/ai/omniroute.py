"""OmniRoute AI provider client.

Credentials come from settings (env / ``.env``) only — never from source code.
Implements the OpenAI-compatible chat completions contract against the
configured OmniRoute gateway.
"""
from __future__ import annotations
from typing import Any, Dict, List

import httpx

from app.core.config import settings


class OmniRouteError(RuntimeError):
    """Raised when the OmniRoute provider cannot be reached or returns an error."""


class OmniRouteClient:
    def __init__(self, base_url: str | None = None, api_key: str | None = None,
                 model: str | None = None, timeout: float | None = None):
        self.base_url = (base_url or settings.OMNIROUTE_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else settings.OMNIROUTE_API_KEY
        self.model = model or settings.OMNIROUTE_MODEL
        self.timeout = timeout or settings.OMNIROUTE_TIMEOUT_SECONDS

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key) and bool(self.base_url)

    @property
    def chat_url(self) -> str:
        """Fully-qualified chat-completions endpoint.

        ``OMNIROUTE_BASE_URL`` is commonly configured *with* the version segment
        (e.g. ``http://localhost:20128/v1``).  Naively appending ``/v1`` to it
        produced ``/v1/v1/chat/completions`` and every request 404'd, so the
        segment is de-duplicated here.
        """
        if self.base_url.rstrip("/").endswith("/v1"):
            return f"{self.base_url}/chat/completions"
        return f"{self.base_url}/v1/chat/completions"

    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.2,
             max_tokens: int = 600) -> str:
        """Send a chat completion request and return the assistant text."""
        if not self.is_configured:
            raise OmniRouteError(
                "OMNIROUTE_API_KEY is not configured. Set it in the backend/.env "
                "file or the process environment."
            )
        url = self.chat_url
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        try:
            resp = httpx.post(url, headers=headers, json=payload, timeout=self.timeout)
        except httpx.HTTPError as e:
            raise OmniRouteError(f"OmniRoute request failed: {e}") from e

        if resp.status_code >= 400:
            raise OmniRouteError(
                f"OmniRoute returned HTTP {resp.status_code}: {resp.text[:300]}"
            )
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as e:
            raise OmniRouteError(f"Unexpected OmniRoute response shape: {data}") from e


omniroute_client = OmniRouteClient()