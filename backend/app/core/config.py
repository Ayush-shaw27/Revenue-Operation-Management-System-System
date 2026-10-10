"""Application configuration.

All environment variables are read from a ``.env`` file placed next to the
``backend/`` folder or from the process environment.  No secrets are ever
committed: ``.env.example`` contains placeholders only, and every value has a
safe development default that can be overridden at deploy time.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# ``backend/`` — i.e. the parent of ``backend/app/core/``.
# ``.env`` is resolved against this directory, not against the current working
# directory.  Previously ``env_file=".env"`` meant the secrets were only loaded
# when uvicorn happened to be started from ``backend/``; starting from the repo
# root silently fell back to the placeholder JWT secret and an unset AI key.
BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

# Placeholder secrets that must never reach production.  Matched loosely,
# because the value actually written into ``.env`` has drifted from the one in
# ``.env.example`` before, and an exact-match check silently stops working the
# moment someone rewords the example file.
PLACEHOLDER_JWT_SECRET = "change-this-to-a-secure-random-secret"
_PLACEHOLDER_SECRET_MARKERS = (
    "change-this",
    "change-me",
    "changeme",
    "your-secret",
    "your-",
    "secure-random-secret",
    "replace-this",
    "replace-me",
    "placeholder",
)


def looks_like_placeholder_secret(value: str) -> bool:
    """True for empty/known-placeholder values that must not be deployed."""
    v = (value or "").strip().lower()
    return not v or any(marker in v for marker in _PLACEHOLDER_SECRET_MARKERS)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core application
    APP_NAME: str = "RevOps Pro"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # Database (SQLite by default; the DB file lives under backend/data/)
    DATABASE_URL: str = "sqlite:///./data/revops.db"

    # JWT authentication
    JWT_SECRET_KEY: str = "change-this-to-a-secure-random-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480

    # xAI / Grok AI provider.
    # The key is read here and nowhere else.  It must NEVER be exposed as a
    # NEXT_PUBLIC_* frontend variable - those are inlined into browser JS.
    # NEVER put a real key here - put it in backend/.env (git-ignored) or in the
    # host's environment variables.  A key committed to this file is picked up
    # by GitHub push protection and blocks the entire push.
    XAI_BASE_URL: str = "https://api.x.ai/v1"
    XAI_API_KEY: str = ""  # set XAI_API_KEY in .env / your host's env vars
    XAI_MODEL: str = "grok-4.7"
    XAI_TIMEOUT_SECONDS: float = 30.0

    # Self-service signup.  Turn this OFF before sharing a public URL:
    # with it on, anyone on the internet can create an account and spend your
    # XAI_API_KEY balance.  Set ALLOW_REGISTRATION=0 and restart.
    ALLOW_REGISTRATION: bool = True

    # CORS - comma separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8080"

    # Seeding / background jobs
    SEED_DIR: str = "data"
    ENRICH_DATA: bool = False
    SCHEDULER_ENABLED: bool = False

    # Rate limiting (fixed-window, per client IP).  These are in-process, so they
    # protect a single instance.  Behind multiple workers/gunicorn or on
    # serverless put a real limiter at the edge instead.
    # LOGIN_RATE_LIMIT counts *all* attempts, successful ones included, so raise
    # it if several people share one IP (a shared office, a demo room, a class).
    LOGIN_RATE_LIMIT: int = 30          # attempts per window, per IP
    LOGIN_RATE_WINDOW_SECONDS: int = 300
    REGISTER_RATE_LIMIT: int = 10
    COPILOT_RATE_LIMIT: int = 20
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def uses_placeholder_jwt_secret(self) -> bool:
        return looks_like_placeholder_secret(self.JWT_SECRET_KEY)

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in {"production", "prod"}

    def ai_gateway_is_local(self) -> bool:
        """True when XAI_BASE_URL points at this machine.

        Compares the parsed *host*, not the whole string: a URL ending in
        ``/v1`` would slip past a naive suffix check.  The shipped default is
        the real ``https://api.x.ai/v1``, which is public and always fine.
        """
        from urllib.parse import urlparse

        host = (urlparse(self.XAI_BASE_URL).hostname or "").lower()
        return host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}

    def assert_production_ready(self) -> None:
        """Fail fast on a configuration that would be unsafe in production.

        A weak JWT secret is silently catastrophic: the whole auth system stays
        "working" while anyone who knows the placeholder can mint an admin
        token.  Better to refuse to boot than to serve that.
        """
        if not self.is_production:
            return
        if self.uses_placeholder_jwt_secret:
            raise RuntimeError(
                "JWT_SECRET_KEY is still the public placeholder. Generate one "
                "with `python -c \"import secrets; print(secrets.token_urlsafe(48))\"` "
                "and set it in your host's environment variables."
            )
        if len(self.JWT_SECRET_KEY) < 32:
            raise RuntimeError(
                f"JWT_SECRET_KEY is too short ({len(self.JWT_SECRET_KEY)} chars); "
                "use at least 32 characters of random data."
            )
        if self.ai_gateway_is_local():
            raise RuntimeError(
                "XAI_BASE_URL points at localhost; a deployed backend cannot reach "
                "your machine. Use https://api.x.ai/v1 or another reachable gateway."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()