"""Tests for gmail_agent.auth.

Covers the W2_AUTH contract: settings provide the credential paths and the
read-only scope, a missing client-secrets file raises a clear error, and the
persisted token is chmod'd to owner-only (0o600). The Google client itself is
mocked so the tests never open a browser or touch the network.
"""

import os

import pytest

import gmail_agent.auth as auth
from gmail_agent.auth import GmailAuthError, get_gmail_service
from gmail_agent.config import PROJECT_ROOT, Settings, get_settings


# ── Settings paths ───────────────────────────────────────────────────


def test_get_settings_provides_expected_auth_paths(monkeypatch):
    # The developer shell may export GMAIL_CREDS_PATH / TOKEN_PATH; make
    # the default-path assertions deterministic.
    monkeypatch.delenv("GMAIL_CREDS_PATH", raising=False)
    monkeypatch.delenv("TOKEN_PATH", raising=False)
    settings = get_settings()
    assert settings.gmail_creds_path == PROJECT_ROOT / "credentials.json"
    assert settings.token_path == PROJECT_ROOT / "token.json"
    assert settings.scopes == ["https://www.googleapis.com/auth/gmail.readonly"]


# ── Missing client secrets ──────────────────────────────────────────


def test_missing_credentials_file_raises_clear_error(tmp_path, monkeypatch):
    # No token.json and no credentials.json exist in tmp_path.
    settings = Settings(
        gmail_creds_path=tmp_path / "credentials.json",
        token_path=tmp_path / "token.json",
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)
    with pytest.raises(GmailAuthError) as excinfo:
        get_gmail_service()
    message = str(excinfo.value)
    assert str(settings.gmail_creds_path) in message
    assert "credentials.json" in message


# ── Token persistence ───────────────────────────────────────────────


class _FakeCreds:
    """Minimal stand-in for google.oauth2.credentials.Credentials."""

    def to_json(self) -> str:
        return '{"token": "fake"}'


def test_token_persisted_with_owner_only_permissions(tmp_path, monkeypatch):
    # Simulate a first-time login: no token on disk, consent flow returns
    # fresh credentials, and the Google client build is a no-op.
    settings = Settings(
        gmail_creds_path=tmp_path / "credentials.json",
        token_path=tmp_path / "token.json",
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)
    monkeypatch.setattr(auth, "_load_credentials", lambda token_path, scopes: None)
    monkeypatch.setattr(
        auth, "_authorize_first_time", lambda creds_path, scopes: _FakeCreds()
    )
    monkeypatch.setattr(auth, "build", lambda name, version, credentials: "service")

    chmod_calls = []
    monkeypatch.setattr(
        auth.os, "chmod", lambda path, mode: chmod_calls.append((path, mode))
    )

    assert get_gmail_service() == "service"
    assert settings.token_path.exists()
    assert settings.token_path.read_text(encoding="utf-8") == '{"token": "fake"}'
    assert chmod_calls == [(settings.token_path, 0o600)]
