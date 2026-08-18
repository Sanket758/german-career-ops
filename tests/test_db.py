"""Tests for gmail_agent.db schema foundation."""

import sqlite3

import pytest

from gmail_agent.db import get_connection, init_db

REQUIRED_TABLES = {"gmail_messages", "application_events", "applications", "gmail_state"}


def test_init_db_creates_all_tables(tmp_path):
    conn = get_connection(tmp_path / "test.db")
    init_db(conn)
    tables = {row[0] for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    )}
    assert REQUIRED_TABLES <= tables
    conn.close()


def test_init_db_is_idempotent(tmp_path):
    conn = get_connection(tmp_path / "test.db")
    init_db(conn)
    init_db(conn)  # second run must not raise
    conn.close()


def test_get_connection_uses_row_factory(tmp_path):
    conn = get_connection(tmp_path / "rows.db")
    assert conn.row_factory is sqlite3.Row
    conn.close()


def test_gmail_messages_schema_has_expected_columns(tmp_path):
    conn = get_connection(tmp_path / "test.db")
    init_db(conn)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(gmail_messages)")}
    expected = {
        "gmail_message_id", "thread_id", "received_at", "sender", "subject",
        "snippet", "body_hash", "language", "processed_at", "classification",
        "classification_confidence", "processing_status",
    }
    assert expected <= columns
    conn.close()


def test_application_events_schema_has_expected_columns(tmp_path):
    conn = get_connection(tmp_path / "test.db")
    init_db(conn)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(application_events)")}
    expected = {
        "event_id", "gmail_message_id", "application_id", "event_type",
        "confidence", "evidence", "created_at",
    }
    assert expected <= columns
    conn.close()


def test_applications_schema_has_expected_columns(tmp_path):
    conn = get_connection(tmp_path / "test.db")
    init_db(conn)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(applications)")}
    expected = {
        "application_id", "company", "position", "status",
        "applied_at", "last_updated",
    }
    assert expected <= columns
    conn.close()


def test_gmail_state_schema_has_expected_columns(tmp_path):
    conn = get_connection(tmp_path / "test.db")
    init_db(conn)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(gmail_state)")}
    expected = {
        "account", "last_history_id", "last_sync_at",
        "last_successful_sync", "watch_expiration",
    }
    assert expected <= columns
    conn.close()
