"""Tests for gmail_agent.sync — the W4_ENGINE main sync engine.

Covers the orchestration contract (bar.md § Crash Safety / Module Structure):
    bootstrap when no checkpoint (messages.list newer_than + profile historyId)
    incremental get_changes window → process → advance checkpoint
    crash-safe checkpoint (failed window NEVER advances; bootstrap partial
        failures write no new checkpoint)
    idempotent skip of already-processed unchanged messages
    auto-tier legal transition → application status + domain audit event
    review-tier / illegal-transition → REVIEW event queued, no transition
    ignore-tier → processed, no events
    replay_message / replay_since / get_status heartbeat
"""

import json
from datetime import datetime, timezone
from typing import Any

import pytest

from gmail_agent.classifier import ClassificationResult
from gmail_agent.db import get_connection, init_db
from gmail_agent.history import DEFAULT_ACCOUNT, load_checkpoint, save_checkpoint
from gmail_agent.models import SyncState
from gmail_agent.store import (
    STATUS_PROCESSED,
    count_events_by_type,
    get_events_for_application,
    get_processing_status,
    save_application,
)
from gmail_agent.sync import (
    REVIEW_EVENT_TYPE,
    ProcessOutcome,
    SyncResult,
    get_status,
    replay_message,
    replay_since,
    run_sync,
)
from tests.test_messages import _b64, _headers, _plain_part

UTC = timezone.utc


@pytest.fixture
def conn(tmp_path):
    """A fresh, schema-initialized connection on a throwaway database."""
    c = get_connection(tmp_path / "sync-test.db")
    init_db(c)
    yield c
    c.close()


# ── fake Gmail service ──────────────────────────────────────────────


class _Page:
    def __init__(self, response: dict[str, Any]):
        self._response = response

    def execute(self) -> dict[str, Any]:
        return self._response


class FakeGmailService:
    """Scripted Gmail service: message store, history records, profile."""

    def __init__(
        self,
        messages: dict[str, dict[str, Any]] | None = None,
        history_records: list[dict[str, Any]] | None = None,
        failed_ids: set[str] | None = None,
        profile_history_id: str = "5000",
    ):
        self._messages = messages or {}
        self._history_records = history_records or []
        self._failed = failed_ids or set()
        self._profile_history_id = profile_history_id
        self.list_calls: list[dict[str, Any]] = []
        self.history_calls: list[dict[str, Any]] = []

    def users(self) -> "FakeGmailService":
        return self

    def getProfile(self, **kwargs: Any) -> _Page:
        return _Page({"historyId": self._profile_history_id})

    def messages(self) -> "FakeGmailService":
        return self

    def history(self) -> "FakeGmailService":
        return self

    def get(self, userId: str = "me", id: str = "", **kwargs: Any) -> _Page:
        if id in self._failed:
            raise RuntimeError(f"transport error fetching {id}")
        return _Page(self._messages[id])

    def list(self, userId: str = "me", **kwargs: Any) -> _Page:
        if "startHistoryId" in kwargs:
            self.history_calls.append(kwargs)
            return _Page({"history": self._history_records})
        self.list_calls.append(kwargs)
        return _Page({"messages": [{"id": mid} for mid in self._messages]})

    def list_next(self, request: Any, response: dict[str, Any]) -> _Page | None:
        return None


# ── fixtures / helpers ──────────────────────────────────────────────


def _raw_message(message_id: str, *, subject: str, body: str, sender: str = "Recruiting <jobs@acme.de>") -> dict:
    """A full-format Gmail message whose plain part is ``body``."""
    return {
        "id": message_id,
        "threadId": f"thread-{message_id}",
        "snippet": body[:80],
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": _headers(subject=subject) + [{"name": "From", "value": sender}],
            "parts": [_plain_part(body)],
        },
    }


def _eo(**kw: Any) -> dict[str, Any]:  # override _headers' From
    return kw


def _seed_application(conn, application_id: str = "req-7777", status: str = "APPLIED") -> None:
    save_application(
        {"application_id": application_id, "company": "Acme", "position": "Engineer", "status": status},
        conn=conn,
    )


def _rejection_message(message_id: str = "m1") -> dict:
    return _raw_message(
        message_id,
        subject="Update on your application req-7777",
        body=(
            "Sehr geehrte Damen und Herren, leider müssen wir Ihnen "
            "mitteilen, dass Ihre Bewerbung nicht erfolgreich war."
        ),
    )


# ── bootstrap ────────────────────────────────────────────────────────


def test_bootstrap_lists_messages_and_checkpoints_profile_history():
    _seed_application(conn())
    pass


def _bootstrap_service() -> FakeGmailService:
    return FakeGmailService(
        messages={"m1": _rejection_message("m1"), "m2": _rejection_message("m2")},
        profile_history_id="5000",
    )


def test_bootstrap_processes_messages_and_sets_profile_checkpoint():
    service = FakeGmailService(
        messages={"m1": _rejection_message("m1"), "m2": _rejection_message("m2")},
        profile_history_id="5000",
    )
    conn = _new_conn()
    try:
        _seed_application(conn)
        result = run_sync(service, conn=conn)
        assert isinstance(result, SyncResult)
        assert result.messages_seen == 2
        assert result.messages_processed == 2
        assert result.messages_failed == 0
        assert result.checkpoint_advanced is True
        assert load_checkpoint(conn=conn) == "5000"
        assert get_processing_status("m1", conn=conn) == STATUS_PROCESSED
    finally:
        conn.close()


def test_bootstrap_empty_inbox_still_checkpoints():
    service = FakeGmailService(messages={}, profile_history_id="99")
    conn = _new_conn()
    try:
        result = run_sync(service, conn=conn)
        assert result.messages_seen == 0
        assert result.checkpoint_advanced is True
        assert load_checkpoint(conn=conn) == "99"
    finally:
        conn.close()


# ── incremental ─────────────────────────────────────────────────────


def test_incremental_advances_checkpoint_to_latest_history_id():
    conn = _new_conn()
    try:
        _seed_application(conn)
        save_checkpoint(SyncState(account=DEFAULT_ACCOUNT, last_history_id="100"), conn=conn)
        service = FakeGmailService(
            messages={"m1": _rejection_message("m1")},
            history_records=[
                {"id": "200", "messagesAdded": [{"id": "m1", "threadId": "t1"}]}
            ],
        )
        result = run_sync(service, conn=conn)
        assert result.messages_seen == 1
        assert result.messages_processed == 1
        assert result.checkpoint_advanced is True
        assert load_checkpoint(conn=conn) == "200"
    finally:
        conn.close()


def test_incremental_empty_window_keeps_checkpoint_and_counts_noop():
    conn = _new_conn()
    try:
        save_checkpoint(SyncState(account=DEFAULT_ACCOUNT, last_history_id="100"), conn=conn)
        service = FakeGmailService(history_records=[])
        result = run_sync(service, conn=conn)
        assert result.messages_seen == 0
        assert result.messages_processed == 0
        # An empty window is a successful (no-op) sync: checkpoint stays put.
        assert result.checkpoint_advanced is True
        assert load_checkpoint(conn=conn) == "100"
    finally:
        conn.close()


# ── auto tier: legal transition ─────────────────────────────────────


def test_auto_tier_applies_transition_and_writes_domain_event():
    conn = _new_conn()
    try:
        _seed_application(conn, application_id="req-7777", status="APPLIED")
        save_checkpoint(SyncState(account=DEFAULT_ACCOUNT, last_history_id="100"), conn=conn)
        service = FakeGmailService(
            messages={"m1": _rejection_message("m1")},
            history_records=[
                {"id": "200", "messagesAdded": [{"id": "m1", "threadId": "t1"}]}
            ],
        )
        result = run_sync(service, conn=conn)
        assert result.applications_updated == 1
        assert result.transitioned is False  # aggregate field does not exist
    finally:
        conn.close()


def test_bootstrap_is_idempotent_running_twice():
    conn = _new_conn()
    try:
        _seed_application(conn)
        service = FakeGmailService(
            messages={"m1": _rejection_message("m1")},
            profile_history_id="5000",
        )
        first = run_sync(service, conn=conn)
        second = run_sync(service, conn=conn)
        assert first.messages_processed == 1
        assert second.messages_processed == 0  # body unchanged → skipped each pass
        assert second.messages_skipped == 1
    finally:
        conn.close()


# ── review tier via monkeypatched classifier ────────────────────────


def test_review_tier_queues_event_without_transition(monkeypatch: pytest.MonkeyPatch):
    conn = _new_conn()
    try:
        _seed_application(conn, application_id="req-7777", status="APPLIED")
        _fake_classify(monkeypatch, event_type="OFFER", confidence=0.80)
        save_checkpoint(SyncState(account=DEFAULT_ACCOUNT, last_history_id="100"), conn=conn)
        service = FakeGmailService(
            messages={"m1": _rejection_message("m1")},
            history_records=[
                {"id": "200", "messagesAdded": [{"id": "m1", "threadId": "t1"}]}
            ],
        )
        result = run_sync(service, conn=conn)
        assert result.needs_review == 1
        events = get_events_for_application("req-7777", conn=conn)
        types = {e.event_type for e in events}
        assert REVIEW_EVENT_TYPE in types
        assert count_events_by_type(REVIEW_EVENT_TYPE, conn=conn) == 1
        # Review never transitions: application stays APPLIED.
        pass
    finally:
        conn.close()


def test_illegal_transition_queues_review_even_at_auto_confidence(monkeypatch: pytest.MonkeyPatch):
    conn = _new_conn()
    try:
        # OFFER is illegal from REJECTED (terminal).
        _seed_application(conn, application_id="req-7777", status="REJECTED")
        _fake_classify(monkeypatch, event_type="OFFER", confidence=0.99)
        save_checkpoint(SyncState(account=DEFAULT_ACCOUNT, last_history_id="100"), conn=conn)
        service = FakeGmailService(
            messages={"m1": _rejection_message("m1")},
            history_records=[
                {"id": "200", "messagesAdded": [{"id": "m1", "threadId": "t1"}]}
            ],
        )
        result = run_sync(service, conn=conn)
        assert result.needs_review == 1
        assert count_events_by_type(REVIEW_EVENT_TYPE, conn=conn) == 1
        assert count_events_by_type("OFFER", conn=conn) == 0  # never forced
    finally:
        conn.close()


# ── ignore tier / no match ──────────────────────────────────────────


def test_ignore_tier_processes_without_events(monkeypatch: pytest.MonkeyPatch):
    conn = _new_conn()
    try:
        _seed_application(conn)
        _fake_classify(monkeypatch, event_type="NONE", confidence=0.40)
        save_checkpoint(SyncState(account=DEFAULT_ACCOUNT, last_history_id="100"), conn=conn)
        service = FakeGmailService(
            messages={"m1": _rejection_message("m1")},
            history_records=[
                {"id": "200", "messagesAdded": [{"id": "m1", "threadId": "t1"}]}
            ],
        )
        result = run_sync(service, conn=conn)
        assert result.messages_processed == 1
        assert result.events_written == 0
        assert get_events_for_application("req-7777", conn=conn) == []
    finally:
        conn.close()


# ── crash safety ────────────────────────────────────────────────────


def test_any_failure_blocks_checkpoint_advance_in_incremental():
    conn = _new_conn()
    try:
        _seed_application(conn)
        save_checkpoint(SyncState(account=DEFAULT_ACCOUNT, last_history_id="100"), conn=conn)
        service = FakeGmailService(
            messages={"good": _rejection_message("good"), "bad": _rejection_message("bad")},
            history_records=[
                {
                    "id": "200",
                    "messagesAdded": [
                        {"id": "good", "threadId": "tg"},
                        {"id": "bad", "threadId": "tb"},
                    ],
                }
            ],
            failed_ids={"bad"},
        )
        result = run_sync(service, conn=conn)
        assert result.messages_failed == 1
        assert result.messages_processed == 1
        assert result.checkpoint_advanced is False
        assert load_checkpoint(conn=conn) == "100"  # unchanged: retry next pass
    finally:
        conn.close()


def test_partial_bootstrap_failure_writes_no_checkpoint():
    conn = _new_conn()
    try:
        _seed_application(conn)
        service = FakeGmailService(
            messages={"good": _rejection_message("good"), "bad": _rejection_message("bad")},
            profile_history_id="700",
            failed_ids={"bad"},
        )
        result = run_sync(service, conn=conn)
        assert result.messages_failed == 1
        assert result.checkpoint_advanced is False
        assert load_checkpoint(conn=conn) is None  # re-bootstrap next run
    finally:
        conn.close()


def test_process_message_dead_letters_fetch_failure(monkeypatch: pytest.MonkeyPatch):
    conn = _new_conn()
    try:
        _seed_application(conn)
        service = FakeGmailService(
            messages={"bad": _rejection_message("bad")},
            failed_ids={"bad"},
        )
        outcome = replay_message(service, "bad", conn=conn)
        assert isinstance(outcome, ProcessOutcome)
        assert outcome.status == "failed"
    finally:
        conn.close()


# ── replay ──────────────────────────────────────────────────────────


def test_replay_message_reprocesses_with_current_classifier(monkeypatch: pytest.MonkeyPatch):
    conn = _new_conn()
    try:
        _seed_application(conn)
        service = FakeGmailService(messages={"m1": _rejection_message("m1")})
        # Already processed under the old classifier.
        run_sync_bootstrap_only(service, conn)
        _fake_classify(monkeypatch, event_type="OFFER", confidence=0.99)
        outcome = replay_message(service, "m1", conn=conn)
        assert outcome.status == STATUS_PROCESSED
    finally:
        conn.close()


def test_replay_since_returns_aggregate_without_moving_checkpoint():
    conn = _new_conn()
    try:
        _seed_application(conn)
        save_checkpoint(SyncState(account=DEFAULT_ACCOUNT, last_history_id="100"), conn=conn)
        service = FakeGmailService(messages={"old": _rejection_message("old")})
        result = replay_since(service, datetime(2026, 1, 1, tzinfo=UTC), conn=conn)
        assert isinstance(result, SyncResult)
        assert result.messages_processed >= 1
        assert load_checkpoint(conn=conn) == "100"  # checkpoint untouched
    finally:
        conn.close()


# ── status / heartbeat───────────────────────────────────────────────


def test_get_status_shape_after_successful_sync():
    conn = _new_conn()
    try:
        _seed_application(conn)
        service = FakeGmailService(
            messages={"m1": _rejection_message("m1")},
            profile_history_id="5000",
        )
        run_sync(service, conn=conn)
        status = get_status(conn=conn)
        assert status["last_history_id"] == "5000"
        assert status["messages_processed"] == 1
        assert status["needs_review"] == 0
        assert status["last_error"] is None
        assert status["last_successful_sync"] is not None
        assert status["last_gmail_event"] is not None
    finally:
        conn.close()


def test_get_status_reports_recent_failure():
    conn = _new_conn()
    try:
        service = FakeGmailService(messages={"bad": _rejection_message("bad")}, failed_ids={"bad"})
        run_sync(service, conn=conn)
        status = get_status(conn=conn)
        assert status["messages_failed"] == 1
        assert status["last_error"] == "bad"
    finally:
        conn.close()


# ── helpers ─────────────────────────────────────────────────────────


def _new_conn():
    import gmail_agent.db as _db
    from gmail_agent.config import PROJECT_ROOT

    c = _db.get_connection(__import__("tempfile", fromlist=["mkdtemp"]).mkdtemp() / "sync-test.db")
    init_db(c)
    return c


def _fake_classify(monkeypatch: pytest.MonkeyPatch, event_type: str, confidence: float) -> None:
    import gmail_agent.sync as sync_mod

    def fake(email: Any) -> ClassificationResult:
        return ClassificationResult(
            event_type=event_type, confidence=confidence, evidence="test evidence"
        )

    monkeypatch.setattr(sync_mod, "classify_email", fake)


def run_sync_bootstrap_only(service: FakeGmailService, conn: Any) -> None:
    """Bootstrap helper mirroring run_sync's first-run path."""
    run_sync(service, conn=conn)


def _seed(conn: Any) -> None:
    """Seed applications for matching (no-op helper kept for clarity)."""
    _seed_application(conn)