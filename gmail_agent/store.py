"""SQLite event store with audit trail (bar.md § SQLite Schema).

W2_SQLITE scope: CRUD over the W1 schema for the sync-engine pipeline.
This module deliberately contains no classification, matching, or state
transition logic — it only persists and reads rows. The engine (W4) and
classifier/matcher (W3) call these helpers.

Every public function accepts an optional ``conn`` so engine stages can
share a single connection/transaction; when omitted, a connection to
``get_settings().database_path`` is opened (and the schema initialized)
for that call and closed afterwards. Each logical unit is committed on
success and rolled back on error — crash-safe per the bar.

Field-name decisions (schema is the contract):
- ``save_normalized_email`` stores ``body_hash`` but never ``body`` —
  the gmail_messages table deliberately has no body column (dedup key
  only, per bar.md).
- ``save_match`` writes a ``MATCH`` audit event carrying the cascade
  ``match_level`` and ``evidence`` as JSON, because no gmail_messages
  column exists for the match; the application_events table is the only
  junction between a message and an application.
- All event rows use ISO-8601 UTC timestamps; Pydantic model fields match
  the schema columns exactly (``event_id``, ``gmail_message_id``,
  ``application_id``, ``event_type``, ``confidence``, ``evidence``,
  ``created_at``).
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from typing import Any

from gmail_agent.config import get_settings
from gmail_agent.db import get_connection, init_db
from gmail_agent.models import (
    ApplicationEvent,
    ClassificationResult,
    MatchResult,
    NormalizedEmail,
)

logger = logging.getLogger(__name__)

# Processing statuses understood by the pipeline (schema default: unprocessed).
STATUS_UNPROCESSED = "unprocessed"
STATUS_PROCESSED = "processed"
STATUS_FAILED = "failed"

# Internal audit event type recorded by save_match() — the association of a
# classified message to an application. Lowercase-free on purpose: domain
# event types (REJECTION, INTERVIEW_INVITE, ...) come from classification,
# so this technical audit type is namespaced away from them.
MATCH_EVENT_TYPE = "MATCH"

# Columns save_application() may write to applications (schema allowlist —
# guards the dynamic UPDATE against injection and typos).
_APPLICATION_FIELDS = {"company", "position", "status", "applied_at", "last_updated"}

_APP_DEFAULTS = {
    "company": "",
    "position": None,
    "status": "APPLIED",
    "applied_at": None,
    "last_updated": None,
}


class StoreError(Exception):
    """Raised when a store operation fails at the SQLite layer."""


# ── internal helpers ──────────────────────────────────────────────────


def _default_conn() -> sqlite3.Connection:
    """Open the configured store connection and ensure the schema exists."""
    conn = get_connection(get_settings().database_path)
    init_db(conn)
    return conn


def _iso(value: datetime) -> str:
    """Serialize a datetime to the ISO-8601 text stored by SQLite."""
    return value.isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    """Parse an ISO-8601 string back into a datetime."""
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _parse_iso_required(value: str | None) -> datetime:
    """Parse a timestamp that the schema guarantees to be present.

    ``received_at`` / ``created_at`` are NOT NULL columns, so a missing or
    malformed value indicates store corruption — surface it loudly instead
    of silently fabricating a timestamp.
    """
    parsed = _parse_iso(value)
    if parsed is None:
        raise StoreError(f"stored timestamp {value!r} is not valid ISO-8601")
    return parsed


def _serialize(value: Any) -> Any:
    """Coerce a Python value into a sqlite-safe one (datetimes → ISO text)."""
    if isinstance(value, datetime):
        return _iso(value)
    return value


def _to_email(row: sqlite3.Row) -> NormalizedEmail:
    """Rebuild a NormalizedEmail from a gmail_messages row.

    The stored ``body_hash`` is preserved; ``body`` is not persisted by
    the schema, so it rehydrates as "" (the model default). ``received_at``
    is NOT NULL in the schema, so it always parses.
    """
    return NormalizedEmail(
        gmail_message_id=row["gmail_message_id"],
        thread_id=row["thread_id"],
        received_at=_parse_iso_required(row["received_at"]),
        sender=row["sender"],
        subject=row["subject"],
        snippet=row["snippet"],
        body="",
        language=row["language"],
        body_hash=row["body_hash"],
    )


def _to_event(row: sqlite3.Row) -> ApplicationEvent:
    """Rebuild an ApplicationEvent from an application_events row."""
    return ApplicationEvent(
        event_id=row["event_id"],
        gmail_message_id=row["gmail_message_id"],
        application_id=row["application_id"],
        event_type=row["event_type"],
        confidence=row["confidence"],
        evidence=row["evidence"],
        created_at=_parse_iso_required(row["created_at"]),
    )


def _close_if_owned(conn: sqlite3.Connection, owns: bool) -> None:
    """Close a connection this call opened (never one the caller provided)."""
    if owns:
        conn.close()


# ── gmail_messages ────────────────────────────────────────────────────


def save_normalized_email(
    email: NormalizedEmail, conn: sqlite3.Connection | None = None
) -> str:
    """Upsert a normalized email into gmail_messages by gmail_message_id.

    Re-saving the same message id refreshes the content columns. When the
    ``body_hash`` changes (the message content changed), the pipeline state
    resets to ``unprocessed`` so the new content is re-processed; otherwise
    ``processing_status`` / ``classification`` / ``processed_at`` are kept,
    making repeated saves idempotent.

    Returns the ``gmail_message_id`` (the row's primary key).
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        conn.execute(
            """
            INSERT INTO gmail_messages (
                gmail_message_id, thread_id, received_at, sender, subject,
                snippet, body_hash, language
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(gmail_message_id) DO UPDATE SET
                thread_id   = excluded.thread_id,
                received_at = excluded.received_at,
                sender      = excluded.sender,
                subject     = excluded.subject,
                snippet     = excluded.snippet,
                body_hash   = excluded.body_hash,
                language    = excluded.language,
                processing_status = CASE
                    WHEN gmail_messages.body_hash <> excluded.body_hash
                    THEN 'unprocessed' ELSE gmail_messages.processing_status
                END,
                processed_at = CASE
                    WHEN gmail_messages.body_hash <> excluded.body_hash
                    THEN NULL ELSE gmail_messages.processed_at
                END,
                classification = CASE
                    WHEN gmail_messages.body_hash <> excluded.body_hash
                    THEN NULL ELSE gmail_messages.classification
                END,
                classification_confidence = CASE
                    WHEN gmail_messages.body_hash <> excluded.body_hash
                    THEN NULL ELSE gmail_messages.classification_confidence
                END
            """,
            (
                email.gmail_message_id,
                email.thread_id,
                _iso(email.received_at),
                email.sender,
                email.subject,
                email.snippet,
                email.body_hash,
                email.language,
            ),
        )
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise StoreError(
            f"failed to save email {email.gmail_message_id!r}: {exc}"
        ) from exc
    finally:
        _close_if_owned(conn, owns)
    return email.gmail_message_id


def get_message_by_id(
    gmail_message_id: str, conn: sqlite3.Connection | None = None
) -> NormalizedEmail | None:
    """Look up one email by ``gmail_message_id`` (None when absent)."""
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        row = conn.execute(
            "SELECT * FROM gmail_messages WHERE gmail_message_id = ?",
            (gmail_message_id,),
        ).fetchone()
        return _to_email(row) if row is not None else None
    finally:
        _close_if_owned(conn, owns)


def get_processing_status(
    message_id: str, conn: sqlite3.Connection | None = None
) -> str | None:
    """Return the ``processing_status`` of a message (None when absent).

    Backs the engine's idempotent-skip: already-processed messages with an
    unchanged body hash are not reclassified on re-fetch.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        row = conn.execute(
            "SELECT processing_status FROM gmail_messages WHERE gmail_message_id = ?",
            (message_id,),
        ).fetchone()
        return str(row["processing_status"]) if row is not None else None
    finally:
        _close_if_owned(conn, owns)


def get_unprocessed_messages(
    conn: sqlite3.Connection | None = None,
) -> list[NormalizedEmail]:
    """Return all messages awaiting processing, oldest first.

    Backs the reprocessing feature (bar.md § Reprocessing): messages whose
    ``processing_status`` is ``unprocessed`` — either never seen or reset by
    a content change — are re-fed through the pipeline.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM gmail_messages WHERE processing_status = ? "
            "ORDER BY received_at",
            (STATUS_UNPROCESSED,),
        ).fetchall()
        return [_to_email(row) for row in rows]
    finally:
        _close_if_owned(conn, owns)


def update_processing_status(
    message_id: str, status: str, conn: sqlite3.Connection | None = None
) -> None:
    """Mark a message ``processed`` / ``failed`` (or reset to ``unprocessed``).

    ``processed_at`` is stamped whenever the message leaves the
    ``unprocessed`` state; resetting to ``unprocessed`` clears it.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    processed_at = None if status == STATUS_UNPROCESSED else _iso(datetime.now(timezone.utc))
    try:
        conn.execute(
            "UPDATE gmail_messages SET processing_status = ?, processed_at = ? "
            "WHERE gmail_message_id = ?",
            (status, processed_at, message_id),
        )
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise StoreError(
            f"failed to update processing status for {message_id!r}: {exc}"
        ) from exc
    finally:
        _close_if_owned(conn, owns)


def count_messages_by_status(
    conn: sqlite3.Connection | None = None,
) -> dict[str, int]:
    """Return a ``{processing_status: count}`` summary over gmail_messages.

    Drives ``gmail status`` / the watchdog heartbeat. Only statuses seen in
    the table appear; missing keys mean zero.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        rows = conn.execute(
            "SELECT processing_status, COUNT(*) AS n FROM gmail_messages GROUP BY processing_status"
        ).fetchall()
        return {str(row["processing_status"]): row["n"] for row in rows}
    finally:
        _close_if_owned(conn, owns)


def count_events_by_type(
    event_type: str, conn: sqlite3.Connection | None = None
) -> int:
    """Count audit-trail rows of one ``event_type`` (e.g. REVIEW / MATCH)."""
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM application_events WHERE event_type = ?",
            (event_type,),
        ).fetchone()
        return row["n"]
    finally:
        _close_if_owned(conn, owns)


def get_latest_event_time(
    conn: sqlite3.Connection | None = None,
) -> datetime | None:
    """Return the created_at of the newest audit-trail event (or None).

    Drives the watchdog's ``last_gmail_event`` heartbeat field.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        row = conn.execute(
            "SELECT created_at FROM application_events ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        return _parse_iso(row["created_at"]) if row is not None else None
    finally:
        _close_if_owned(conn, owns)


def get_recent_failed_messages(
    limit: int = 1, conn: sqlite3.Connection | None = None
) -> list[dict[str, Any]]:
    """Return the most recently failed messages (newest first).

    Each dict carries at least ``gmail_message_id`` and ``processed_at`` —
    enough for the watchdog to report the last error without growing the
    schema. Failed rows keep their message id and a processed_at stamp, so
    reconcilers can retry by id.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        rows = conn.execute(
            "SELECT gmail_message_id, processed_at FROM gmail_messages "
            "WHERE processing_status = ? ORDER BY processed_at DESC LIMIT ?",
            (STATUS_FAILED, limit),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        _close_if_owned(conn, owns)


def save_classification(
    message_id: str, result: ClassificationResult, conn: sqlite3.Connection | None = None
) -> None:
    """Persist a ClassificationResult onto its gmail_messages row.

    Stores ``event_type`` into ``classification`` and ``confidence`` into
    ``classification_confidence`` (the columns the schema reserves for it).
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        cur = conn.execute(
            "UPDATE gmail_messages SET classification = ?, classification_confidence = ? "
            "WHERE gmail_message_id = ?",
            (result.event_type, result.confidence, message_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            logger.warning(
                "save_classification: no gmail_messages row for %s", message_id
            )
    except sqlite3.Error as exc:
        conn.rollback()
        raise StoreError(
            f"failed to save classification for {message_id!r}: {exc}"
        ) from exc
    finally:
        _close_if_owned(conn, owns)


# ── application_events (audit trail) ──────────────────────────────────


def save_application_event(
    event: ApplicationEvent, conn: sqlite3.Connection | None = None
) -> str:
    """Insert one immutable event row into the audit trail.

    Idempotent by ``event_id`` (INSERT OR IGNORE): re-delivering the same
    event — e.g. a replayed message — never duplicates the trail. Returns
    the ``event_id``.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO application_events ("
            " event_id, gmail_message_id, application_id, event_type,"
            " confidence, evidence, created_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                event.event_id,
                event.gmail_message_id,
                event.application_id,
                event.event_type,
                event.confidence,
                event.evidence,
                _iso(event.created_at),
            ),
        )
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise StoreError(
            f"failed to save event {event.event_id!r}: {exc}"
        ) from exc
    finally:
        _close_if_owned(conn, owns)
    return event.event_id


def save_match(
    message_id: str, result: MatchResult, conn: sqlite3.Connection | None = None
) -> str:
    """Record a message→application association as a ``MATCH`` audit event.

    The cascade ``match_level`` and matcher ``evidence`` are stored as JSON
    in the event's evidence column — the only schema slot for match
    metadata. Idempotent per (message, application) pair: the deterministic
    ``event_id`` (``match:{message_id}:{application_id}``) makes replays
    no-ops. Returns the ``event_id``.
    """
    event = ApplicationEvent(
        event_id=f"match:{message_id}:{result.application_id}",
        gmail_message_id=message_id,
        application_id=result.application_id,
        event_type=MATCH_EVENT_TYPE,
        confidence=result.confidence,
        evidence=json.dumps(
            {"match_level": result.match_level.value, "evidence": result.evidence},
            ensure_ascii=False,
        ),
    )
    return save_application_event(event, conn=conn)


def get_events_for_application(
    application_id: str, conn: sqlite3.Connection | None = None
) -> list[ApplicationEvent]:
    """Return the full audit trail for an application, oldest first.

    Chronological (``created_at``, then ``event_id`` for a stable order
    between same-timestamp rows). Includes both domain events and the
    ``MATCH`` association events.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM application_events WHERE application_id = ? "
            "ORDER BY created_at, event_id",
            (application_id,),
        ).fetchall()
        return [_to_event(row) for row in rows]
    finally:
        _close_if_owned(conn, owns)


# ── applications (tracker side of the matching) ───────────────────────


def get_all_applications(
    conn: sqlite3.Connection | None = None,
) -> list[dict[str, Any]]:
    """Return every tracked application as a dict (for the W3 matcher).

    Used by the cascade matcher to try ID / sender+company / subject
    matching against the tracker's known applications.
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM applications ORDER BY application_id"
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        _close_if_owned(conn, owns)


def save_application(
    app_data: dict[str, Any], conn: sqlite3.Connection | None = None
) -> str:
    """Upsert one application row by ``application_id``.

    Insert fills schema defaults (``status='APPLIED'``); on conflict only
    the fields actually present in ``app_data`` are updated, so a status
    change never wipes ``position``/``applied_at``. ``last_updated``
    defaults to now. Raises StoreError for a missing ``application_id`` or
    unknown keys. Returns the ``application_id``.
    """
    application_id = app_data.get("application_id")
    if not application_id:
        raise StoreError("save_application requires a non-empty 'application_id'")
    unknown = set(app_data) - _APPLICATION_FIELDS - {"application_id"}
    if unknown:
        raise StoreError(f"save_application: unknown fields {sorted(unknown)}")

    owns = conn is None
    if owns:
        conn = _default_conn()

    now = datetime.now(timezone.utc)
    updates: dict[str, Any] = {
        key: value for key, value in app_data.items() if key != "application_id"
    }
    updates.setdefault("last_updated", now)

    insert_values = [_APP_DEFAULTS.get(key) if key not in app_data else _serialize(app_data[key])
                     for key in ("company", "position", "status", "applied_at", "last_updated")]
    try:
        # OR IGNORE: a fresh row is inserted; an existing one is skipped here
        # and patched by the partial UPDATE below.
        conn.execute(
            "INSERT OR IGNORE INTO applications ("
            " application_id, company, position, status, applied_at, last_updated"
            ") VALUES (?, ?, ?, ?, ?, ?)",
            (application_id, *insert_values),
        )
        set_clause = ", ".join(f"{key} = ?" for key in updates)
        conn.execute(
            f"UPDATE applications SET {set_clause} WHERE application_id = ?",
            (*[_serialize(value) for value in updates.values()], application_id),
        )
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise StoreError(
            f"failed to save application {application_id!r}: {exc}"
        ) from exc
    finally:
        _close_if_owned(conn, owns)
    return application_id
