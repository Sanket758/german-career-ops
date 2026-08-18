"""Tests for gmail_agent.config settings."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from gmail_agent.config import PROJECT_ROOT, Settings


def test_settings_defaults_match_existing_conventions():
    settings = Settings()
    assert settings.ollama_url == "http://localhost:11434"
    assert settings.ollama_model == "gemma4:e2b-it-q4_K_M"
    assert settings.lookback_days == 30
    assert settings.auto_threshold == 0.90
    assert settings.review_threshold == 0.70
    assert settings.scopes == ["https://www.googleapis.com/auth/gmail.readonly"]


def test_settings_paths_resolve_under_project_root(monkeypatch):
    # The developer shell may export GMAIL_CREDS_PATH / TOKEN_PATH; make
    # the default-path assertions deterministic.
    monkeypatch.delenv("GMAIL_CREDS_PATH", raising=False)
    monkeypatch.delenv("TOKEN_PATH", raising=False)
    settings = Settings()
    assert settings.gmail_creds_path == PROJECT_ROOT / "credentials.json"
    assert settings.token_path == PROJECT_ROOT / "token.json"
    assert settings.database_path == PROJECT_ROOT / "gmail_agent" / "gmail.db"
    assert settings.log_dir == PROJECT_ROOT / "logs"


def test_settings_environment_overrides(monkeypatch):
    monkeypatch.setenv("OLLAMA_URL", "http://ollama.internal:9999")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen2.5:7b")
    monkeypatch.setenv("GMAIL_LOOKBACK_DAYS", "7")
    settings = Settings()
    assert settings.ollama_url == "http://ollama.internal:9999"
    assert settings.ollama_model == "qwen2.5:7b"
    assert settings.lookback_days == 7


def test_settings_auto_threshold_must_be_above_review_threshold():
    with pytest.raises(ValidationError):
        Settings(auto_threshold=0.5, review_threshold=0.70)


def test_settings_thresholds_must_be_within_unit_interval():
    with pytest.raises(ValidationError):
        Settings(auto_threshold=1.5)
    with pytest.raises(ValidationError):
        Settings(review_threshold=-0.2)


def test_settings_derives_log_paths_from_log_dir():
    log_dir = Path("/tmp/gauntlet-w1/logs")
    settings = Settings(log_dir=log_dir)
    assert settings.operational_log_path == log_dir / "gmail-service.log"
    assert settings.events_log_path == log_dir / "events.jsonl"
    assert settings.dead_letter_log_path == log_dir / "dead-letter.jsonl"
