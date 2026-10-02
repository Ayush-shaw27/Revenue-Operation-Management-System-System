"""Application configuration.

All environment variables are read from a ``.env`` file placed next to the
``backend/`` folder or from the process environment.  No secrets are ever
committed: ``.env.example`` contains placeholders only, and every value has a
safe development default that can be overridden at deploy time.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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

    # OmniRoute AI provider (settings-only credentials; never hardcode keys)
    OMNIROUTE_BASE_URL: str = "http://localhost:8080"
    OMNIROUTE_API_KEY: str = ""
    OMNIROUTE_MODEL: str = "revops-ai-v1"
    OMNIROUTE_TIMEOUT_SECONDS: float = 30.0

    # CORS - comma separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8080"

    # Seeding / background jobs
    SEED_DIR: str = "data"
    ENRICH_DATA: bool = False
    SCHEDULER_ENABLED: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()