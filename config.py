"""
Environment separation: .env file, dev vs production, config class.
Set PUAA_ENV=production in production; default is development.
"""

import os
from pathlib import Path

# Load .env from project root (where you run uvicorn)
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path)


class Config:
    """Single config class; values from env with sensible defaults."""

    # Environment: development | production
    ENV: str = os.getenv("PUAA_ENV", "development")
    IS_PRODUCTION: bool = ENV.lower() == "production"

    # Database: different DB per environment
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./app.db" if ENV != "production" else "sqlite:///./app_production.db",
    )

    # Auth (override in production via .env)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-me")
    ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO" if IS_PRODUCTION else "DEBUG")

    # Cache TTL for property list (seconds); 0 = disabled. Default 0 to avoid stale listings in development.
    CACHE_PROPERTIES_TTL: int = int(os.getenv("CACHE_PROPERTIES_TTL", "0"))

    # Pagination defaults
    DEFAULT_PAGE_SIZE: int = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
    MAX_PAGE_SIZE: int = int(os.getenv("MAX_PAGE_SIZE", "100"))


config = Config()
