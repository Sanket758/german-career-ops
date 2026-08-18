"""Tests for gmail_agent.history — Gmail History API sync primitives.

Covers the W2_HISTORY contract: paginated ``users.history.list`` fetching
(with a mocked service — never a real API call), messagesAdded extraction,
historyId advancement, and crash-safe ``gmail_state`` checkpoint round-trips.
"""

from datetime import datetime, timezone
from typing import Any

import pytest

from gmail_agent.db import get_connection, init_db
from gmail_agent.history import (
    HistoryError,
    extract_history_id,
    extract_message_ids,
    get_changes,
    load_checkpoint,
    load_sync_state,
    save_checkpoint,
)
from gmail_agent.models import SyncState

UTC = timezone.utc


@pytest.fixture
def conn(tmp_path):
    """A fresh, schema-initialized connection on a throwaway database."""
    c = get_connection(tmp_path / "history-test.db")
    init_db(c)
    yield c
    c.close()


def _sync_state(**overrides: Any) -> SyncState:
    """A valid SyncState with stable defaults (all fields populated)."""
    defaults: dict[str, Any] = dict(
        account="me",
        last_history_id="9000",
        last_sync_at=datetime(2026, 8, 8, 12, 0, tzinfo=UTC),
        last_successful_sync=datetime(2026, 8, 8, 11, 0, tzinfo=UTC),
        watch_expiration=datetime(2026, 8, 15, 12, 0, tzinfo=UTC),
    )
    defaults.update(overrides)
    return SyncState(**defaults)


def _history_record(
    record_id: int, messages_added: list[str] | None = None
) -> dict[str, Any]:
    """One raw Gmail history record; messagesAdded ids are wrapped as dicts."""
    record: dict[str, Any] = {"id": record_id}
    if messages_added is not None:
        record["messagesAdded"] = [{"id": m, "threadId": f"t:{m}"} for m in messages_added]
    return record


# ── mock Gmail service (service.users().history().list / list_next) ──


class _Page:
    """A history-list response; execute() returns it once."""

    _response: dict[str, Any]

    def __init__(self, response: dict[str, Any]):
        self._response = response

    def execute(self) -> dict[str, Any]:
        return self._response


class _HistoryApi:
    _service: "FakeGmailService"

    def __init__(self, service: "FakeGmailService"):
        self._service = service

    def list(self, **kwargs: Any) -> _Page | None:
        self._service.list_kwargs.append(kwargs)
        return self._service._next_page()

    def list_next(self, request: Any, response: dict[str, Any]) -> _Page | None:
        self._service.list_next_calls.append((request, response))
        return self._service._next_page()


class _Users:
    _service: "FakeGmailService"

    def __init__(self, service: "FakeGmailService"):
        self._service = service

    def history(self) -> _HistoryApi:
        return _HistoryApi(self._service)


class FakeGmailService:
    """Serves a scripted sequence of history-list pages."""

    _pages: list[dict[str, Any]]
    list_kwargs: list[dict[str, Any]]
    list_next_calls: list[tuple[Any, Any]]

    def __init__(self, pages: list[dict[str, Any]]):
        self._pages = list(pages)
        self.list_kwargs = []
        self.list_next_calls = []

    def _next_page(self) -> _Page | None:
        return _Page(self._pages.pop(0)) if self._pages else None

    def users(self) -> _Users:
        return _Users(self)


# ── extract_message_ids ──────────────────────────────────────────────


def test_extract_message_ids_collects_messages_added():
    records = [
        _history_record(1, messages_added=["m1", "m2"]),
        _history_record(2, messages_added=["m3"]),
        _history_record(3),  # no messagesAdded at all
    ]
    assert extract_message_ids(records) == ["m1", "m2", "m3"]


def test_extract_message_ids_ignores_non_added_changes():
    """labelsAdded / labelsRemoved / messagesDeleted are NOT new messages."""
    records = [
        {
            "id": 10,
            "labelsAdded": [{"id": "m9", "threadId": "t9"}],
            "labelsRemoved": [{"id": "m8", "threadId": "t8"}],
            "messagesDeleted": [{"id": "m7", "threadId": "t7"}],
        },
        _history_record(11, messages_added=["m5"]),
    ]
    assert extract_message_ids(records) == ["m5"]


def test_extract_message_ids_dedupes_across_records():
    records = [
        _history_record(1, messages_added=["m1", "m2"]),
        _history_record(2, messages_added=["m2", "m3"]),  # m2 re-seen
    ]
    assert extract_message_ids(records) == ["m1", "m2", "m3"]


def test_extract_message_ids_empty_input():
    assert extract_message_ids([]) == []
    assert extract_message_ids([_history_record(1), {"labelsAdded": []}]) == []


# ── extract_history_id ───────────────────────────────────────────────


def test_extract_history_id_picks_latest():
    records = [
        _history_record(5000),
        _history_record(12345),  # out of order — max wins
        _history_record(9000),
    ]
    assert extract_history_id(records) == "12345"


def test_extract_history_id_returns_string_preserving_uint64():
    """historyIds exceed 2^53; must round-trip as str, never lose precision."""
    big = 2**60 + 123
    assert extract_history_id([_history_record(big)]) == str(big)


def test_extract_history_id_empty_window_returns_none():
    assert extract_history_id([]) is None


def test_extract_history_id_ignores_records_without_id():
    assert extract_history_id([{"messagesAdded": []}, _history_record(7)]) == "7"


# ── get_changes (pagination + contract) ──────────────────────────────


def test_get_changes_merges_pages_via_next_page_token():
    page1 = {"history": [_history_record(1, ["m1"])], "nextPageToken": "tok-1"}
    page2 = {"history": [_history_record(2, ["m2"])]}
    service = FakeGmailService([page1, page2])

    records = get_changes(service, "9000")

    assert [r["id"] for r in records] == [1, 2]
    assert service.list_kwargs == [{"userId": "me", "startHistoryId": "9000"}]
    assert len(service.list_next_calls) == 1


def test_get_changes_stops_when_no_next_page_token():
    service = FakeGmailService([{"history": [_history_record(1, ["m1"])]}])

    records = get_changes(service, "9000")

    assert [r["id"] for r in records] == [1]
    assert service.list_next_calls == []  # page had no token → loop ended


def test_get_changes_no_changes_returns_empty_list():
    service = FakeGmailService([{"history": []}])
    assert get_changes(service, "9000") == []


def test_get_changes_requires_checkpoint():
    """No checkpoint → HistoryError, never a malformed API call."""
    service = FakeGmailService([])
    with pytest.raises(HistoryError):
        get_changes(service, None)
    with pytest.raises(HistoryError):
        get_changes(service, "")
    assert service.list_kwargs == []  # list() never reached


def test_get_changes_respects_max_pages_cap():
    """A pathological API that never clears the token cannot hang the loop."""
    service = FakeGmailService(
        [
            {"history": [_history_record(1)], "nextPageToken": "t"},
            {"history": [_history_record(2)], "nextPageToken": "t"},
            {"history": [_history_record(3)]},
        ]
    )
    records = get_changes(service, "9000", max_pages=2)
    assert [r["id"] for r in records] == [1, 2]


# ── checkpoint round-trips (gmail_state) ─────────────────────────────


def test_save_load_checkpoint_round_trip(conn):
    state = _sync_state()
    save_checkpoint(state, conn=conn)

    loaded = load_sync_state(conn=conn)
    assert loaded is not None
    assert loaded.account == "me"
    assert loaded.last_history_id == "9000"
    assert loaded.last_sync_at == state.last_sync_at
    assert loaded.last_successful_sync == state.last_successful_sync
    assert loaded.watch_expiration == state.watch_expiration

    assert load_checkpoint(conn=conn) == "9000"


def test_load_checkpoint_none_when_no_row(conn):
    assert load_sync_state(conn=conn) is None
    assert load_checkpoint(conn=conn) is None


def test_save_checkpoint_overwrites_atomically(conn):
    save_checkpoint(_sync_state(last_history_id="9000"), conn=conn)
    save_checkpoint(
        _sync_state(last_history_id="9123", last_sync_at=None), conn=conn
    )

    loaded = load_sync_state(conn=conn)
    assert loaded.last_history_id == "9123"  # advanced
    assert loaded.last_sync_at is None  # overwritten, not merged
    assert loaded.last_successful_sync is not None  # untouched fields replaced


def test_save_checkpoint_round_trip_minimal_state(conn):
    """A bare checkpoint (just an id, no timestamps) round-trips fine."""
    save_checkpoint(SyncState(account="me", last_history_id="42"), conn=conn)
    loaded = load_sync_state(conn=conn)
    assert loaded.last_history_id == "42"
    assert loaded.last_sync_at is None
    assert loaded.last_successful_sync is None
    assert loaded.watch_expiration is None


def test_save_load_scoped_to_account(conn):
    save_checkpoint(_sync_state(account="me", last_history_id="100"), conn=conn)
    save_checkpoint(_sync_state(account="work", last_history_id="200"), conn=conn)

    assert load_checkpoint(account="me", conn=conn) == "100"
    assert load_checkpoint(account="work", conn=conn) == "200"
    assert load_checkpoint(account="nobody", conn=conn) is None


def test_save_checkpoint_uses_settings_database_path(tmp_path, monkeypatch):
    """Without an explicit conn, save/load use get_settings().database_path."""
    from gmail_agent import config

    db_file = tmp_path / "settings-history.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    config.get_settings.cache_clear()
    try:
        save_checkpoint(_sync_state())  # no conn → own connection on settings path
        assert load_checkpoint() == "9000"
    finally:
        config.get_settings.cache_clear()


# ── import contract ──────────────────────────────────────────────────


def test_module_imports_cleanly_and_exposes_primitives():
    import gmail_agent.history as history

    required = {
        "get_changes",
        "load_checkpoint",
        "load_sync_state",
        "save_checkpoint",
        "extract_message_ids",
        "extract_history_id",
    }
    assert required <= set(dir(history))
