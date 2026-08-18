"""Application settings for the Gmail sync engine (pydantic-settings).

Env-compatible with the existing scripts: the same variables the current
integration honors — ``GMAIL_CREDS_PATH``, ``GMAIL_LOOKBACK_DAYS``,
``TOKEN_PATH``, ``OLLAMA_URL``, ``OLLAMA_MODEL`` — keep working unchanged.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root: gmail_agent/config.py → package dir → project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime configuration for the sync engine.

    Values resolve from (in order): init kwargs, environment variables,
    then the defaults below. No .env file is read — the service is
    configured by the environment (systemd unit / shell) like the
    existing gmail_sync.py.
    """

    model_config = SettingsConfigDict(
        env_prefix="",
        env_file=None,
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    # ── Ollama (defaults mirror scripts/career_ops_cli.py) ──────────────
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "gemma4:e2b-it-q4_K_M"

    # ── Gmail OAuth (paths mirror scripts/gmail_sync.py) ─────────────────
    gmail_creds_path: Path = PROJECT_ROOT / "credentials.json"
    token_path: Path = PROJECT_ROOT / "token.json"
    scopes: list[str] = ["https://www.googleapis.com/auth/gmail.readonly"]
    # Accept both LOOKBACK_DAYS and the historical GMAIL_LOOKBACK_DAYS.
    lookback_days: int = Field(
        default=30, ge=1,
        validation_alias=AliasChoices("lookback_days", "gmail_lookback_days"),
    )

    # ── Confidence thresholds (bar.md: >=0.90 auto, 0.70-0.90 review, <0.70 ignore) ──
    auto_threshold: float = Field(default=0.90, ge=0.0, le=1.0)
    review_threshold: float = Field(default=0.70, ge=0.0, le=1.0)

    # ── Storage ──────────────────────────────────────────────────────────
    database_path: Path = PROJECT_ROOT / "gmail_agent" / "gmail.db"
    log_dir: Path = PROJECT_ROOT / "logs"

    @model_validator(mode="after")
    def _thresholds_ordered(self) -> "Settings":
        if self.auto_threshold < self.review_threshold:
            raise ValueError("auto_threshold must be >= review_threshold")
        return self

    # ── 3-layer logging paths (bar.md § Logging) ─────────────────────────
    @property
    def operational_log_path(self) -> Path:
        return self.log_dir / "gmail-service.log"

    @property
    def events_log_path(self) -> Path:
        return self.log_dir / "events.jsonl"

    @property
    def dead_letter_log_path(self) -> Path:
        return self.log_dir / "dead-letter.jsonl"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide cached settings (safe to call from any stage)."""
    return Settings()
