"""xAI (Grok) provider client — the single place the AI key is used.

This module replaced ``omniroute.py``. Everything AI-related now flows through
here, so there is exactly one file to audit and one environment variable to
configure.

Design rules, in priority order:

1. **The key is read from settings and nowhere else.** No hardcoded keys, no
   key in a URL, no key in a log line.  This module never returns or prints it.
2. **Errors never carry the key.** Upstream error bodies are summarised to a
   status code rather than echoed, because those bodies can contain request
   metadata and this text used to reach the browser via ``/copilot/ask``.
3. **Never required.** With no key configured the copilot falls back to the
   local rule engine and says so, so the app still runs without an AI account.

Docs: https://docs.x.ai/developers/rest-api-reference
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

import httpx

from app.core.config import settings

# xAI serves an OpenAI-compatible API.  Overridable so a proxy or a self-hosted
# mock can be used in tests, but the default is the real public endpoint.
DEFAULT_BASE_URL = "https://api.x.ai/v1"


class ProviderError(RuntimeError):
    """Raised when the AI provider cannot be reached or returns an error."""


class GrokClient:
    """Thin client over xAI's ``/chat/completions`` endpoint."""

    def __init__(self, base_url: str | None = None, api_key: str | None = None,
                 model: str | None = None, timeout: float | None = None):
        self.base_url = (base_url or settings.XAI_BASE_URL or DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else settings.XAI_API_KEY
        self.model = model or settings.XAI_MODEL
        self.timeout = timeout or settings.XAI_TIMEOUT_SECONDS

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key) and bool(self.base_url)

    @property
    def chat_url(self) -> str:
        """Fully-qualified chat-completions endpoint.

        The base URL is commonly configured *with* the version segment already
        present (that is the shipped default).  Naively appending ``/v1`` to it
        produces ``/v1/v1/chat/completions`` and every request 404s, so the
        segment is de-duplicated here.
        """
        if self.base_url.endswith("/v1"):
            return f"{self.base_url}/chat/completions"
        return f"{self.base_url}/v1/chat/completions"

    def _redact(self, text: str) -> str:
        """Strip anything key-shaped out of a string bound for a log or a user."""
        return text.replace(self.api_key, "***") if self.api_key else text

    def _build_request(self, messages: List[Dict[str, str]], temperature: float,
                       max_tokens: int) -> Tuple[str, Dict[str, str], Dict[str, Any]]:
        if not self.is_configured:
            raise ProviderError(
                "XAI_API_KEY is not configured. Set it in backend/.env or in your "
                "host's environment variables."
            )
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        return self.chat_url, headers, payload

    @staticmethod
    def _extract(resp: Any, redact) -> str:
        if resp.status_code >= 400:
            # Report the status, not the body. 401/403 in particular can echo
            # back request metadata, and this string is surfaced to the caller.
            hint = {
                400: (
                    " (the request was rejected - most often an API key that is "
                    "not a real xAI key, or a model name your key cannot access; "
                    "keys start with 'xai-' and you can create one at "
                    "https://console.x.ai)"
                ),
                401: " (check XAI_API_KEY - the key was rejected)",
                403: " (key may lack access to this model)",
                404: " (check XAI_MODEL - that model does not exist for your key)",
                429: " (rate limited or out of credit)",
            }.get(resp.status_code, "")
            raise ProviderError(
                f"xAI returned HTTP {resp.status_code}{hint}"
            )
        try:
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as e:
            raise ProviderError(
                f"Unexpected xAI response shape: {redact(str(data))[:200]}"
            ) from e

    # -- public API ---------------------------------------------------------
    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.2,
             max_tokens: int = 600) -> str:
        """Blocking chat completion.  Prefer :meth:`chat_async` in async code."""
        url, headers, payload = self._build_request(messages, temperature, max_tokens)
        try:
            resp = httpx.post(url, headers=headers, json=payload, timeout=self.timeout)
        except httpx.HTTPError as e:
            raise ProviderError(f"xAI request failed: {self._redact(str(e))}") from e
        return self._extract(resp, self._redact)

    async def chat_async(self, messages: List[Dict[str, str]], temperature: float = 0.2,
                         max_tokens: int = 600) -> str:
        """Async chat completion.  **Use this from async endpoints.**

        A blocking ``httpx.post`` inside an ``async def`` route holds the event
        loop for the whole provider call: one copilot question made ``/health``
        go from 0.15s to 3.5s, and with a long timeout configured it stalls
        every other request in the process.
        """
        url, headers, payload = self._build_request(messages, temperature, max_tokens)
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as e:
            raise ProviderError(f"xAI request failed: {self._redact(str(e))}") from e
        return self._extract(resp, self._redact)


grok_client = GrokClient()