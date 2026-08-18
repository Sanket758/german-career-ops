"""Gmail OAuth authentication (W2_AUTH).

Authenticates with the Gmail API via OAuth 2.0 using a desktop-installed-app
client secret. This is the same flow ``scripts/gmail_sync.py`` uses, restructured
for the engine: paths and scopes come from ``get_settings()`` instead of module
constants, and the happy path / refresh path / first-time path are split into
small testable helpers.

Only the read-only scope is requested (bar.md: "Gmail is an event source only" —
the sync engine never writes to the mailbox).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from gmail_agent.config import get_settings


class GmailAuthError(RuntimeError):
    """Raised when Gmail credentials cannot be obtained."""


def _load_credentials(token_path: Path, scopes: list[str]) -> Credentials | None:
    """Load persisted credentials from ``token_path``, or None if absent."""
    if not os.path.exists(token_path):
        return None
    return Credentials.from_authorized_user_file(str(token_path), scopes)


def _authorize_first_time(creds_path: Path, scopes: list[str]) -> Credentials:
    """Run the interactive OAuth consent flow against a client secrets file.

    Raises :class:`GmailAuthError` with setup guidance when the client
    secrets file is missing — a clear message beats a raw FileNotFoundError
    that says nothing about where the file should live.
    """
    if not os.path.exists(creds_path):
        raise GmailAuthError(
            f"Gmail client secrets file not found at {creds_path}. "
            "Download credentials.json from the Google Cloud Console "
            "(APIs & Services → Credentials → OAuth client → Desktop app), "
            "place it there, or point GMAIL_CREDS_PATH at it."
        )
    flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), scopes)
    return flow.run_local_server(port=0)


def _persist_token(creds: Credentials, token_path: Path) -> None:
    """Persist credentials to ``token_path`` with owner-only permissions."""
    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(creds.to_json(), encoding="utf-8")
    os.chmod(token_path, 0o600)


def get_gmail_service() -> Any:
    """Return an authenticated Gmail API service (read-only scope).

    Resolution order:
      1. Load an existing token from ``settings.token_path``.
      2. If it is expired but refreshable, refresh it in place.
      3. Otherwise run the first-time interactive OAuth consent flow.
      4. Persist the resulting credentials before building the service.
    """
    settings = get_settings()

    creds = _load_credentials(settings.token_path, settings.scopes)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            creds = _authorize_first_time(settings.gmail_creds_path, settings.scopes)
        _persist_token(creds, settings.token_path)

    return build("gmail", "v1", credentials=creds)
