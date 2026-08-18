"""Gmail History API sync primitives with crash-safe checkpointing.

W2_HISTORY: the change-fetch layer of the sync engine (bar.md § Crash Safety
and § Sync State). This module talks to ``users.history.list`` and persists
the ``gmail_state`` checkpoint row; it deliberately contains no message
normalization (W2_MESSAGES), classification/matching (W3), or state-machine
work (W4).

CRASH-SAFE CONTRACT (read before using):
    The bar requires this exact ordering, never the reverse:

        fetch changes → persist raw event → process event → update tracker
        → commit processed state → advance checkpoint

    NEVER: fetch → advance checkpoint → process   (loses events on crash)

    This module exposes *primitives only*: ``get_changes`` fetches raw
    history records, ``extract_*`` derives message ids / the next historyId
    from them, and ``save_checkpoint`` / ``load_checkpoint`` persist and read
    the checkpoint. **Orchestration — deciding WHEN to persist, and
    advancing the checkpoint only after processing commits — is the engine's
    job (W4_ENGINE).** No function here advances a checkpoint on its own.

    Two consequences fall out of the contract and are relied on by the
    engine:
      * ``get_changes`` NEVER writes and NEVER advances state. If the
        process dies mid-window, the next run re-fetches from the same
        ``last_history_id`` and re-processes — downstream persistence is
        idempotent (upsert by message id, INSERT OR IGNORE events).
      * ``save_checkpoint`` is a single atomic UPSERT committed on success
        and rolled back on error; a crash either leaves the old checkpoint
        (safe re-fetch) or the fully-new one — never a partial row.

    ``last_history_id`` is a Gmail historyId (uint64) kept as a string end to
    end (SQLite TEXT, Pydantic ``SyncState.last_history_id``) so JSON/SQLite
    round-trips cannot lose precision beyond 2^53.

Every public function accepts an optional ``conn`` so the engine can share
one connection/transaction across stages; when omitted, a connection to
``get_settings().database_path`` is opened (and the schema initialized) for
that call and closed afterwards — mirroring ``gmail_agent.store``.
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime
from typing import Any

from gmail_agent.config import get_settings
from gmail_agent.db import get_connection, init_db
from gmail_agent.models import SyncState

logger = logging.getLogger(__name__)

# The Gmail API user id used throughout the sync engine ("me" = the
# authenticated account). Overridable per call; mirrors SyncState.account.
DEFAULT_ACCOUNT = "me"


class HistoryError(Exception):
    """Raised when a history-fetch or checkpoint operation fails.

    Covers both contract violations (e.g. ``get_changes`` called before a
    checkpoint exists) and SQLite errors raised while persisting state.
    """


# ── internal helpers (mirror gmail_agent.store conventions) ──────────


def _default_conn() -> sqlite3.Connection:
    """Open the configured store connection and ensure the schema exists."""
    conn = get_connection(get_settings().database_path)
    init_db(conn)
    return conn


def _iso(value: datetime) -> str:
    """Serialize a datetime to the ISO-8601 text stored by SQLite."""
    return value.isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    """Parse an ISO-8601 string back into a datetime (None stays None)."""
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _close_if_owned(conn: sqlite3.Connection, owns: bool) -> None:
    """Close a connection this call opened (never one the caller provided)."""
    if owns:
        conn.close()


def _to_sync_state(row: sqlite3.Row) -> SyncState:
    """Rebuild a SyncState from a gmail_state row (None timestamps stay None)."""
    return SyncState(
        account=row["account"],
        last_history_id=row["last_history_id"],
        last_sync_at=_parse_iso(row["last_sync_at"]),
        last_successful_sync=_parse_iso(row["last_successful_sync"]),
        watch_expiration=_parse_iso(row["watch_expiration"]),
    )


# ── Gmail History API fetch ──────────────────────────────────────────


def get_changes(
    service: Any,
    last_history_id: str | None,
    *,
    max_pages: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch history records since ``last_history_id``, across all pages.

    Calls ``service.users().history().list(userId='me',
    startHistoryId=last_history_id)`` and follows ``nextPageToken`` via
    ``list_next`` until exhausted, merging every page's ``history`` list into
    one flat list of raw Gmail history records. Nothing is written or
    checkpointed here (see the module crash-safety contract).

    Args:
        service: an authorized Gmail service (``gmail_agent.auth``).
        last_history_id: the checkpoint historyId (str). Must be non-empty —
            with no checkpoint the engine must bootstrap (initial messages
            fetch) before change-tracking can start. ``None``/``""`` raises
            ``HistoryError`` rather than issuing a malformed API request.
        max_pages: defensive cap on API pages fetched (default: unlimited).
            A pathological API that never clears ``nextPageToken`` cannot
            hang the service; the returned window is then truncated.

    Returns:
        Merged list of raw history records (``[{"id": ..., "messagesAdded":
        [...], ...}, ...]``). Empty when there are no changes since the
        checkpoint — the engine keeps the current checkpoint on such no-op
        syncs (re-fetching an empty window is idempotent and safe).
    """
    if not last_history_id:
        raise HistoryError(
            "get_changes requires a non-empty last_history_id; with no "
            "checkpoint the engine must bootstrap before change-tracking"
        )

    records: list[dict[str, Any]] = []
    request = service.users().history().list(
        userId=DEFAULT_ACCOUNT, startHistoryId=last_history_id
    )
    page = 0
    while request is not None:
        page += 1
        if max_pages is not None and page > max_pages:
            logger.warning(
                "get_changes: page cap %d reached (truncated window)", max_pages
            )
            break
        response = request.execute()
        records.extend(response.get("history") or [])
        request = (
            service.users().history().list_next(request, response)
            if response.get("nextPageToken")
            else None
        )
    return records


def extract_message_ids(history_records: list[dict[str, Any]]) -> list[str]:
    """Return the ids of messages added since the checkpoint.

    Only ``messagesAdded`` contributes — that is the *new mail* signal. A
    message that merely changed labels (``labelsAdded`` / ``labelsRemoved``)
    or was deleted (``messagesDeleted``) is not new and is deliberately
    ignored: the normalizer re-fetches unchanged content for nothing and the
    pipeline would re-trigger on label churn.

    Order-preserving and deduplicated: the same message id can appear across
    several history records (e.g. added then re-added in a threaded sync), so
    the returned list contains each id exactly once, in first-seen order.
    Records without a ``messagesAdded`` key (or with an empty list) are
    skipped.
    """
    seen: set[str] = set()
    ids: list[str] = []
    for record in history_records:
        for item in record.get("messagesAdded") or []:
            message_id = item.get("id")
            if message_id and message_id not in seen:
                seen.add(message_id)
                ids.append(message_id)
    return ids


def extract_history_id(history_records: list[dict[str, Any]]) -> str | None:
    """Return the latest history record id for advancing the checkpoint.

    Gmail history records each carry a monotonically increasing ``id``
    (uint64). The max across the window is the safe next ``startHistoryId``:
    advancing to it never skips an event, and re-fetching an already-seen
    record is harmless because downstream persistence is idempotent.

    Returns the max id as a string (matching ``SyncState.last_history_id``'
    TEXT representation; uint64 ids exceed 2^53 and must not pass through
    int/float). Returns ``None`` for an empty window — no changes to advance
    past — in which case the engine keeps its current checkpoint (safe no-op,
    see the module crash-safety contract).
    """
    best: int | None = None
    for record in history_records:
        try:
            value = int(record["id"])
        except (KeyError, TypeError, ValueError):
            continue
        if best is None or value > best:
            best = value
    return str(best) if best is not None else None


# ── checkpoint persistence (gmail_state) ─────────────────────────────


def load_checkpoint(
    account: str = DEFAULT_ACCOUNT, conn: sqlite3.Connection | None = None
) -> str | None:
    """Return the persisted ``last_history_id`` for ``account``.

    ``None`` when no checkpoint row exists yet or the row's
    ``last_history_id`` is empty — i.e. the engine must bootstrap before it
    can call ``get_changes``. Only the id is returned; use
    ``load_sync_state`` for the full row.
    """
    state = load_sync_state(account=account, conn=conn)
    if state is None or not state.last_history_id:
        return None
    return state.last_history_id


def load_sync_state(
    account: str = DEFAULT_ACCOUNT, conn: sqlite3.Connection | None = None
) -> SyncState | None:
    """Return the full persisted ``SyncState`` for ``account`` (None if absent)."""
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        row = conn.execute(
            "SELECT * FROM gmail_state WHERE account = ?", (account,)
        ).fetchone()
        return _to_sync_state(row) if row is not None else None
    except sqlite3.Error as exc:
        raise HistoryError(f"failed to load sync state for {account!r}: {exc}") from exc
    finally:
        _close_if_owned(conn, owns)


def save_checkpoint(
    sync_state: SyncState, conn: sqlite3.Connection | None = None
) -> None:
    """Atomically persist a ``SyncState`` checkpoint into gmail_state.

    Single UPSERT keyed on ``account`` (the table's primary key): a fresh
    row is inserted, an existing one is fully overwritten. The commit is the
    atomicity boundary — on success every field of the passed state is
    durable; on error the transaction is rolled back and the previous
    checkpoint (if any) is left untouched, so a crash can never leave a
    partial row. Safe to call with any combination of fields set (e.g. a
    bare ``SyncState(account=..., last_history_id=...)`` after processing
    commits).
    """
    owns = conn is None
    if owns:
        conn = _default_conn()
    try:
        conn.execute(
            """
            INSERT INTO gmail_state (
                account, last_history_id, last_sync_at,
                last_successful_sync, watch_expiration
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(account) DO UPDATE SET
                last_history_id      = excluded.last_history_id,
                last_sync_at         = excluded.last_sync_at,
                last_successful_sync = excluded.last_successful_sync,
                watch_expiration     = excluded.watch_expiration
            """,
            (
                sync_state.account,
                sync_state.last_history_id,
                _iso(sync_state.last_sync_at) if sync_state.last_sync_at else None,
                _iso(sync_state.last_successful_sync)
                if sync_state.last_successful_sync
                else None,
                _iso(sync_state.watch_expiration)
                if sync_state.watch_expiration
                else None,
            ),
        )
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        raise HistoryError(
            f"failed to save checkpoint for {sync_state.account!r}: {exc}"
        ) from exc
    finally:
        _close_if_owned(conn, owns)
