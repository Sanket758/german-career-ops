"""Tests for gmail_agent.store — SQLite event store with audit trail.

Covers the W2_SQLITE contract: save + retrieve of normalized emails,
the classification → match → event persistence chain, audit-trail reads,
reprocessing queries, and idempotency (re-saves must not duplicate rows).
"""

import json
from datetime import datetime, timezone
from typing import Any

import pytest

from gmail_agent.db import get_connection, init_db
from gmail_agent.models import (
    ApplicationEvent,
    ClassificationResult,
    MatchLevel,
    MatchResult,
    NormalizedEmail,
)
from gmail_agent.store import (
    STATUS_PROCESSED,
    STATUS_UNPROCESSED,
    get_all_applications,
    get_events_for_application,
    get_message_by_id,
    get_unprocessed_messages,
    save_application,
    save_application_event,
    save_classification,
    save_match,
    save_normalized_email,
    update_processing_status,
)

UTC = timezone.utc


@pytest.fixture
def conn(tmp_path):
    """A fresh, schema-initialized connection on a throwaway database."""
    c = get_connection(tmp_path / "store-test.db")
    init_db(c)
    yield c
    c.close()


def _email(message_id: str = "m1", **overrides: Any) -> NormalizedEmail:
    """A valid NormalizedEmail with stable defaults."""
    defaults: dict[str, Any] = dict(
        gmail_message_id=message_id,
        thread_id="t1",
        received_at=datetime(2026, 8, 1, 9, 0, tzinfo=UTC),
        sender="Recruiting <recruiting@acme.de>",
        subject="Ihre Bewerbung",
        snippet="vielen Dank für Ihre Bewerbung",
        body="Sehr geehrte Damen und Herren, …",
        language="de",
    )
    defaults.update(overrides)
    return NormalizedEmail(**defaults)


def _classification(
    event_type: str = "REJECTION", confidence: float = 0.95
) -> ClassificationResult:
    return ClassificationResult(
        event_type=event_type,
        confidence=confidence,
        evidence="subject + sender keyword hit",
        rule_score=0.9,
    )


def _match(
    application_id: str = "a42",
    level: MatchLevel = MatchLevel.SENDER_COMPANY,
    confidence: float = 0.85,
) -> MatchResult:
    return MatchResult(
        application_id=application_id,
        confidence=confidence,
        match_level=level,
        evidence="sender domain matches company domain",
    )


def _event(
    event_id: str = "evt-1",
    event_type: str = "INTERVIEW_INVITE",
    confidence: float = 0.92,
    **overrides: Any,
) -> ApplicationEvent:
    defaults: dict[str, Any] = dict(
        event_id=event_id,
        gmail_message_id="m1",
        application_id="a42",
        event_type=event_type,
        confidence=confidence,
        evidence="invitation wording detected",
        created_at=datetime(2026, 8, 2, 10, 0, tzinfo=UTC),
    )
    defaults.update(overrides)
    return ApplicationEvent(**defaults)


# ── save + retrieve NormalizedEmail ──────────────────────────────────


def test_save_and_retrieve_normalized_email(conn):
    email = _email(body="Hallo Welt")
    save_normalized_email(email, conn=conn)

    stored = get_message_by_id("m1", conn=conn)
    assert stored is not None
    assert stored.gmail_message_id == "m1"
    assert stored.thread_id == "t1"
    assert stored.sender == "Recruiting <recruiting@acme.de>"
    assert stored.subject == "Ihre Bewerbung"
    assert stored.snippet == "vielen Dank für Ihre Bewerbung"
    assert stored.language == "de"
    assert stored.body_hash == email.body_hash  # sha256 of "Hallo Welt"
    assert stored.received_at == email.received_at


def test_get_message_by_id_returns_none_when_absent(conn):
    assert get_message_by_id("missing", conn=conn) is None


def test_default_connection_uses_settings_database_path(tmp_path, monkeypatch):
    """Without an explicit conn, store() uses get_settings().database_path."""
    from gmail_agent import config

    db_file = tmp_path / "settings-path.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    config.get_settings.cache_clear()
    try:
        save_normalized_email(_email())  # no conn → own connection on settings path
        stored = get_message_by_id("m1")
        assert stored is not None
        assert stored.gmail_message_id == "m1"
    finally:
        config.get_settings.cache_clear()


# ── classification + match + event chain ─────────────────────────────


def test_save_classification_persists_type_and_confidence(conn):
    save_normalized_email(_email(), conn=conn)
    save_classification("m1", _classification(), conn=conn)

    row = conn.execute(
        "SELECT classification, classification_confidence FROM gmail_messages "
        "WHERE gmail_message_id = 'm1'"
    ).fetchone()
    assert row["classification"] == "REJECTION"
    assert row["classification_confidence"] == pytest.approx(0.95)


def test_save_match_records_match_event_with_level_and_evidence(conn):
    save_normalized_email(_email(), conn=conn)
    event_id = save_match("m1", _match(), conn=conn)

    assert event_id == "match:m1:a42"
    events = get_events_for_application("a42", conn=conn)
    assert len(events) == 1
    match_event = events[0]
    assert match_event.event_type == "MATCH"
    assert match_event.application_id == "a42"
    assert match_event.gmail_message_id == "m1"
    payload = json.loads(match_event.evidence)
    assert payload["match_level"] == "sender_company"
    assert "company domain" in payload["evidence"]


def test_classification_match_event_chain(conn):
    """The full W3→W4 write path: message → classified → matched → domain event."""
    save_normalized_email(_email(), conn=conn)
    save_classification("m1", _classification(), conn=conn)
    save_match("m1", _match(), conn=conn)
    save_application_event(_event(), conn=conn)

    # message carries its classification
    row = conn.execute(
        "SELECT classification FROM gmail_messages WHERE gmail_message_id = 'm1'"
    ).fetchone()
    assert row["classification"] == "REJECTION"

    # audit trail has both the MATCH association and the domain event
    # (MATCH is stamped with wall-clock now, so order vs the fixed-ts
    # domain event is not asserted — membership is the contract)
    trail = get_events_for_application("a42", conn=conn)
    assert len(trail) == 2
    assert {e.event_type for e in trail} == {"MATCH", "INTERVIEW_INVITE"}


# ── audit trail ──────────────────────────────────────────────────────


def test_get_events_for_application_returns_audit_trail(conn):
    save_application_event(_event("evt-1", "APPLIED", created_at=datetime(2026, 8, 1, 8, 0, tzinfo=UTC)), conn=conn)
    save_application_event(_event("evt-2", "SCREENING", created_at=datetime(2026, 8, 3, 12, 0, tzinfo=UTC)), conn=conn)
    save_application_event(_event("evt-3", "INTERVIEW_INVITE", created_at=datetime(2026, 8, 2, 10, 0, tzinfo=UTC)), conn=conn)

    trail = get_events_for_application("a42", conn=conn)
    assert [e.event_type for e in trail] == ["APPLIED", "INTERVIEW_INVITE", "SCREENING"]

    first = trail[0]
    assert first.event_id == "evt-1"
    assert first.confidence == pytest.approx(0.92)
    assert first.evidence == "invitation wording detected"
    assert first.created_at == datetime(2026, 8, 1, 8, 0, tzinfo=UTC)


def test_get_events_for_application_scoped_to_application(conn):
    save_application_event(_event("evt-1", application_id="a42"), conn=conn)
    save_application_event(_event("evt-2", application_id="a99"), conn=conn)

    assert len(get_events_for_application("a42", conn=conn)) == 1
    assert get_events_for_application("nobody", conn=conn) == []


# ── reprocessing ─────────────────────────────────────────────────────


def test_get_unprocessed_messages(conn):
    save_normalized_email(_email("m1"), conn=conn)
    save_normalized_email(_email("m2", received_at=datetime(2026, 8, 2, 9, 0, tzinfo=UTC)), conn=conn)
    save_normalized_email(_email("m3", received_at=datetime(2026, 8, 3, 9, 0, tzinfo=UTC)), conn=conn)
    update_processing_status("m2", STATUS_PROCESSED, conn=conn)

    pending = get_unprocessed_messages(conn=conn)
    assert [e.gmail_message_id for e in pending] == ["m1", "m3"]  # oldest first, processed excluded


def test_update_processing_status_stamps_processed_at(conn):
    save_normalized_email(_email(), conn=conn)
    update_processing_status("m1", STATUS_PROCESSED, conn=conn)

    row = conn.execute(
        "SELECT processing_status, processed_at FROM gmail_messages "
        "WHERE gmail_message_id = 'm1'"
    ).fetchone()
    assert row["processing_status"] == "processed"
    assert row["processed_at"] is not None

    update_processing_status("m1", STATUS_UNPROCESSED, conn=conn)
    row = conn.execute(
        "SELECT processed_at FROM gmail_messages WHERE gmail_message_id = 'm1'"
    ).fetchone()
    assert row["processed_at"] is None


# ── idempotency ──────────────────────────────────────────────────────


def test_save_same_email_twice_no_duplicate(conn):
    save_normalized_email(_email(), conn=conn)
    save_normalized_email(_email(), conn=conn)

    count = conn.execute(
        "SELECT COUNT(*) FROM gmail_messages WHERE gmail_message_id = 'm1'"
    ).fetchone()[0]
    assert count == 1


def test_resave_keeps_processing_state_when_body_unchanged(conn):
    save_normalized_email(_email(), conn=conn)
    update_processing_status("m1", STATUS_PROCESSED, conn=conn)
    save_normalized_email(_email(), conn=conn)  # same content

    row = conn.execute(
        "SELECT processing_status FROM gmail_messages WHERE gmail_message_id = 'm1'"
    ).fetchone()
    assert row["processing_status"] == "processed"  # state preserved → idempotent


def test_resave_with_changed_body_resets_to_unprocessed(conn):
    save_normalized_email(_email(), conn=conn)
    update_processing_status("m1", STATUS_PROCESSED, conn=conn)
    save_normalized_email(_email(body="COMPLETELY DIFFERENT BODY"), conn=conn)

    row = conn.execute(
        "SELECT processing_status, classification FROM gmail_messages "
        "WHERE gmail_message_id = 'm1'"
    ).fetchone()
    assert row["processing_status"] == STATUS_UNPROCESSED  # re-process new content
    assert row["classification"] is None


def test_save_same_event_twice_no_duplicate(conn):
    save_application_event(_event(), conn=conn)
    save_application_event(_event(), conn=conn)

    count = conn.execute(
        "SELECT COUNT(*) FROM application_events WHERE event_id = 'evt-1'"
    ).fetchone()[0]
    assert count == 1


def test_save_match_twice_no_duplicate(conn):
    save_normalized_email(_email(), conn=conn)
    save_match("m1", _match(), conn=conn)
    save_match("m1", _match(), conn=conn)

    count = conn.execute(
        "SELECT COUNT(*) FROM application_events WHERE event_id = 'match:m1:a42'"
    ).fetchone()[0]
    assert count == 1


# ── applications table (matcher input) ───────────────────────────────


def test_save_and_get_all_applications(conn):
    save_application(
        {"application_id": "a42", "company": "Acme GmbH", "position": "Data Engineer"},
        conn=conn,
    )
    save_application(
        {"application_id": "a7", "company": "Beispiel AG", "position": "ML Engineer"},
        conn=conn,
    )

    apps = get_all_applications(conn=conn)
    assert [a["application_id"] for a in apps] == ["a42", "a7"]  # lexically ordered
    by_id = {a["application_id"]: a for a in apps}
    assert by_id["a42"]["company"] == "Acme GmbH"
    assert by_id["a42"]["status"] == "APPLIED"  # schema default
    assert by_id["a42"]["last_updated"] is not None


def test_save_application_updates_only_provided_fields(conn):
    save_application(
        {"application_id": "a42", "company": "Acme GmbH", "position": "Data Engineer"},
        conn=conn,
    )
    save_application({"application_id": "a42", "status": "SCREENING"}, conn=conn)

    app = get_all_applications(conn=conn)[0]
    assert app["status"] == "SCREENING"
    assert app["position"] == "Data Engineer"  # untouched by partial update
    assert app["company"] == "Acme GmbH"


def test_save_application_requires_application_id(conn):
    with pytest.raises(Exception):
        save_application({"company": "Acme GmbH"}, conn=conn)
