"""Pydantic models — the data contract for the Gmail sync engine.

Layer map (later waves build on these interfaces):
    NormalizedEmail       ← W2_MESSAGES / W2_PARSER
    ClassificationResult  ← W3_CLASS
    MatchResult           ← W3_MATCH
    ApplicationEvent      ← W4_ENGINE (event-store rows)
    SyncState             ← W2_STATE (historyId checkpoint)

These models are intentionally logic-free. Classification rules, matching
cascades, and state transitions live in their owning waves; this module only
defines shapes, bounds, and serialization — the schema the pipeline agrees on.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, model_validator


def _sha256(text: str) -> str:
    """Hex sha256 digest of a string (used for body dedup)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    """Timezone-aware UTC timestamp for event `created_at` defaults."""
    return datetime.now(timezone.utc)


class MatchLevel(str, Enum):
    """Cascade level of the 5-level application matcher (see bar.md).

    Order matters: lower index = stronger evidence. The matcher (W3_MATCH)
    tries ID first and falls back level by level to semantic matching.
    """

    ID = "id"
    SENDER_COMPANY = "sender_company"
    SUBJECT = "subject"
    BODY_ENTITIES = "body_entities"
    SEMANTIC = "semantic"


class NormalizedEmail(BaseModel):
    """A single Gmail message normalized for downstream processing.

    ``body_hash`` is auto-computed from ``body`` (sha256) when not provided,
    giving the event store a stable dedup key across re-syncs.
    """

    gmail_message_id: str = Field(min_length=1)
    thread_id: str = Field(min_length=1)
    received_at: datetime
    sender: str
    subject: str = ""
    snippet: str = ""
    body: str = ""
    language: str = "unknown"
    body_hash: str = ""

    @model_validator(mode="after")
    def _ensure_body_hash(self) -> "NormalizedEmail":
        """Auto-compute ``body_hash`` (sha256 of body) when not provided.

        Runs as an after-validator so it also fires for the field default
        (Pydantic v2 skips before-validators on default values).
        """
        if not self.body_hash:
            self.body_hash = _sha256(self.body)
        return self


class ClassificationResult(BaseModel):
    """Multi-signal classification of a job-application email (W3_CLASS).

    Signal scores are optional (a rule-only pass has no ``llm_score``);
    ``confidence`` is the fused 0..1 value the state machine keys on.
    """

    event_type: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str = ""
    rule_score: float | None = Field(default=None, ge=0.0, le=1.0)
    llm_score: float | None = Field(default=None, ge=0.0, le=1.0)
    sender_score: float | None = Field(default=None, ge=0.0, le=1.0)


class MatchResult(BaseModel):
    """Outcome of matching a classified email to a tracked application.

    ``match_level`` records how far down the 5-level cascade the matcher
    had to go — evidence strength for confidence scoring and audit.
    """

    application_id: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    match_level: MatchLevel
    evidence: str = ""


class ApplicationEvent(BaseModel):
    """One immutable, auditable event row for the SQLite event store."""

    event_id: str = Field(min_length=1)
    gmail_message_id: str = Field(min_length=1)
    application_id: str = Field(min_length=1)
    event_type: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class SyncState(BaseModel):
    """Crash-safe Gmail sync checkpoint (see bar.md § Sync State).

    ``last_history_id`` is a Gmail historyId (uint64) — kept as a string so
    JSON/SQLite round-trips cannot lose precision beyond 2^53.
    """

    account: str = Field(default="me", min_length=1)
    last_history_id: str = ""
    last_sync_at: datetime | None = None
    last_successful_sync: datetime | None = None
    watch_expiration: datetime | None = None
