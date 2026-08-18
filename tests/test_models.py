"""Validation tests for gmail_agent.models.

Covers the W1 data contract: every model must construct from its required
fields, enforce bounds/format where documented, and round-trip through JSON
(the persistence format used by the event store and JSONL logs).
"""

from datetime import datetime

import pytest
from pydantic import ValidationError

from gmail_agent.models import (
    ApplicationEvent,
    ClassificationResult,
    MatchLevel,
    MatchResult,
    NormalizedEmail,
    SyncState,
)


# ── NormalizedEmail ──────────────────────────────────────────────────


def test_normalized_email_constructs_with_required_fields():
    email = NormalizedEmail(
        gmail_message_id="1902abcd",
        thread_id="1902efgh",
        received_at=datetime(2026, 8, 1, 9, 30),
        sender="Recruiting <recruiting@acme.de>",
    )
    assert email.subject == ""
    assert email.snippet == ""
    assert email.body == ""
    assert email.language == "unknown"
    assert len(email.body_hash) == 64  # sha256 hex digest


def test_normalized_email_computes_body_hash_from_body():
    a = NormalizedEmail(
        gmail_message_id="m1", thread_id="t1",
        received_at=datetime(2026, 8, 1), sender="x@y.de", body="Hallo Welt",
    )
    b = NormalizedEmail(
        gmail_message_id="m2", thread_id="t2",
        received_at=datetime(2026, 8, 1), sender="x@y.de", body="Hallo Welt",
    )
    assert a.body_hash == b.body_hash


def test_normalized_email_body_hash_changes_with_body():
    a = NormalizedEmail(
        gmail_message_id="m1", thread_id="t1",
        received_at=datetime(2026, 8, 1), sender="x@y.de", body="Hallo",
    )
    b = NormalizedEmail(
        gmail_message_id="m2", thread_id="t2",
        received_at=datetime(2026, 8, 1), sender="x@y.de", body="Tschüss",
    )
    assert a.body_hash != b.body_hash


def test_normalized_email_respects_explicit_body_hash():
    email = NormalizedEmail(
        gmail_message_id="m1", thread_id="t1",
        received_at=datetime(2026, 8, 1), sender="x@y.de",
        body="anything", body_hash="provided-hash",
    )
    assert email.body_hash == "provided-hash"


def test_normalized_email_requires_message_and_thread_ids():
    base = dict(thread_id="t1", received_at=datetime(2026, 8, 1), sender="x@y.de")
    with pytest.raises(ValidationError):
        NormalizedEmail(**base)  # gmail_message_id missing
    with pytest.raises(ValidationError):
        NormalizedEmail(gmail_message_id="m1", received_at=datetime(2026, 8, 1), sender="x@y.de")  # thread_id missing


def test_normalized_email_rejects_empty_message_id():
    with pytest.raises(ValidationError):
        NormalizedEmail(
            gmail_message_id="", thread_id="t1",
            received_at=datetime(2026, 8, 1), sender="x@y.de",
        )


def test_normalized_email_json_roundtrip_preserves_fields():
    email = NormalizedEmail(
        gmail_message_id="m1", thread_id="t1",
        received_at=datetime(2026, 8, 1, 12, 0), sender="recruiting@acme.de",
        subject="Ihre Bewerbung", snippet="vielen Dank", body="Sehr geehrte…",
        language="de",
    )
    clone = NormalizedEmail.model_validate_json(email.model_dump_json())
    assert clone == email
    assert clone.body_hash == email.body_hash


# ── ClassificationResult ─────────────────────────────────────────────


def test_classification_result_defaults_to_empty_evidence():
    result = ClassificationResult(event_type="REJECTION", confidence=0.95, rule_score=0.9)
    assert result.evidence == ""
    assert result.llm_score is None
    assert result.sender_score is None


def test_classification_result_rejects_confidence_out_of_range():
    with pytest.raises(ValidationError):
        ClassificationResult(event_type="REJECTION", confidence=1.1)
    with pytest.raises(ValidationError):
        ClassificationResult(event_type="REJECTION", confidence=-0.1)


def test_classification_result_rejects_scores_out_of_range():
    with pytest.raises(ValidationError):
        ClassificationResult(event_type="REJECTION", confidence=0.5, llm_score=2.0)
    with pytest.raises(ValidationError):
        ClassificationResult(event_type="REJECTION", confidence=0.5, sender_score=-0.3)


# ── MatchResult ──────────────────────────────────────────────────────


def test_match_result_accepts_enum_level():
    result = MatchResult(
        application_id="a42", confidence=0.8,
        match_level=MatchLevel.SUBJECT, evidence="subject keyword hit",
    )
    assert result.match_level is MatchLevel.SUBJECT


def test_match_result_coerces_string_level_to_enum():
    result = MatchResult(application_id="a42", confidence=0.9, match_level="semantic")
    assert result.match_level is MatchLevel.SEMANTIC


def test_match_result_rejects_unknown_level():
    with pytest.raises(ValidationError):
        MatchResult(application_id="a42", confidence=0.9, match_level="telepathy")


def test_match_result_accepts_max_confidence():
    result = MatchResult(application_id="a42", confidence=0.99, match_level="semantic")
    assert result.confidence == 0.99


def test_match_result_rejects_confidence_above_one():
    with pytest.raises(ValidationError):
        MatchResult(application_id="a42", confidence=1.01, match_level="semantic")


# ── ApplicationEvent ─────────────────────────────────────────────────


def test_application_event_defaults_evidence_and_timestamp():
    event = ApplicationEvent(
        event_id="evt-1", gmail_message_id="m1", application_id="a42",
        event_type="INTERVIEW_INVITE", confidence=0.9,
    )
    assert event.evidence == ""
    assert event.created_at is not None
    assert event.created_at.tzinfo is not None  # UTC-aware default


def test_application_event_requires_identifiers():
    base = dict(gmail_message_id="m1", application_id="a42", event_type="X", confidence=0.5)
    with pytest.raises(ValidationError):
        ApplicationEvent(**base)  # event_id missing


def test_application_event_json_roundtrip_preserves_timestamp():
    event = ApplicationEvent(
        event_id="evt-1", gmail_message_id="m1", application_id="a42",
        event_type="OFFER", confidence=0.98, evidence="offer wording detected",
    )
    clone = ApplicationEvent.model_validate_json(event.model_dump_json())
    assert clone == event
    assert clone.created_at == event.created_at


# ── SyncState ────────────────────────────────────────────────────────


def test_sync_state_defaults_to_empty_checkpoint():
    state = SyncState(account="me")
    assert state.last_history_id == ""
    assert state.last_sync_at is None
    assert state.last_successful_sync is None
    assert state.watch_expiration is None


def test_sync_state_full_checkpoint_roundtrip():
    state = SyncState(
        account="me", last_history_id="1857652290123456789",
        last_sync_at=datetime(2026, 8, 9, 10, 0),
        last_successful_sync=datetime(2026, 8, 9, 10, 0),
        watch_expiration=datetime(2026, 8, 16, 10, 0),
    )
    clone = SyncState.model_validate_json(state.model_dump_json())
    assert clone == state
    # history ids are uint64 — must survive JSON without precision loss
    assert clone.last_history_id == "1857652290123456789"
