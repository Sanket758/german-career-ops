"""SQLite event-store foundation (bar.md § SQLite Schema).

W1 scope: connection + schema creation only. Queries, CRUD, checkpointing,
and reconciliation queries belong to W2_SQLITE / W2_STATE. The schema
mirrors the bar: ``gmail_messages``, ``application_events``,
``applications``, plus ``gmail_state`` for the sync checkpoint.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS gmail_messages (
    gmail_message_id          TEXT PRIMARY KEY,
    thread_id                 TEXT NOT NULL,
    received_at               TEXT NOT NULL,
    sender                    TEXT NOT NULL,
    subject                   TEXT NOT NULL DEFAULT '',
    snippet                   TEXT NOT NULL DEFAULT '',
    body_hash                 TEXT NOT NULL DEFAULT '',
    language                  TEXT NOT NULL DEFAULT 'unknown',
    processed_at              TEXT,
    classification            TEXT,
    classification_confidence REAL,
    processing_status         TEXT NOT NULL DEFAULT 'unprocessed'
);

CREATE TABLE IF NOT EXISTS application_events (
    event_id          TEXT PRIMARY KEY,
    gmail_message_id  TEXT NOT NULL,
    application_id    TEXT NOT NULL,
    event_type        TEXT NOT NULL,
    confidence        REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    evidence          TEXT NOT NULL DEFAULT '',
    created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
    application_id TEXT PRIMARY KEY,
    company        TEXT NOT NULL,
    position       TEXT,
    status         TEXT NOT NULL DEFAULT 'APPLIED',
    applied_at     TEXT,
    last_updated   TEXT
);

CREATE TABLE IF NOT EXISTS gmail_state (
    account              TEXT PRIMARY KEY,
    last_history_id      TEXT NOT NULL DEFAULT '',
    last_sync_at         TEXT,
    last_successful_sync TEXT,
    watch_expiration     TEXT
);

CREATE INDEX IF NOT EXISTS idx_application_events_message
    ON application_events (gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_application_events_application
    ON application_events (application_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_thread
    ON gmail_messages (thread_id);
"""


def get_connection(db_path: str | Path) -> sqlite3.Connection:
    """Open a SQLite connection with Row access and WAL journaling.

    Creates the parent directory if missing. Foreign-key enforcement is
    left off deliberately: the pipeline may persist a message or event
    before the matched application row exists.
    """
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=OFF")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Create all tables and indexes if missing. Safe to call repeatedly.

    Idempotent: re-running over an existing store is a no-op, which makes
    it safe to call on every service start.
    """
    conn.executescript(_SCHEMA_SQL)
    conn.commit()
