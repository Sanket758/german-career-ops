"""gmail_agent — foundation package for the Gmail sync engine.

W1_FOUND: the data-contract models, settings, 3-layer logging, and SQLite
schema. Later waves (W2 auth/history/messages, W3 classify/match,
W4 engine/review/reconciliation) build the pipeline on these interfaces.
"""

from __future__ import annotations

from gmail_agent import (
    auth,
    classifier,
    config,
    db,
    history,
    logging_config,
    matcher,
    messages,
    models,
    store,
)
from gmail_agent.auth import GmailAuthError, get_gmail_service
from gmail_agent.classifier import classify_email, confidence_tier
from gmail_agent.config import PROJECT_ROOT, Settings, get_settings
from gmail_agent.matcher import match_email
from gmail_agent.models import (
    ApplicationEvent,
    ClassificationResult,
    MatchLevel,
    MatchResult,
    NormalizedEmail,
    SyncState,
)

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "PROJECT_ROOT",
    "Settings",
    "get_settings",
    "NormalizedEmail",
    "ClassificationResult",
    "MatchResult",
    "ApplicationEvent",
    "SyncState",
    "MatchLevel",
    "GmailAuthError",
    "get_gmail_service",
    "classify_email",
    "confidence_tier",
    "match_email",
    "models",
    "config",
    "auth",
    "db",
    "history",
    "logging_config",
    "store",
    "messages",
    "classifier",
    "matcher",
]
