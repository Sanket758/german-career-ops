"""Main sync engine (W4_ENGINE) — orchestrates the full pipeline.

Wire order (bar.md § Crash Safety):
    fetch changes → persist raw event → process event → update tracker →
    commit processed state → advance checkpoint
NEVER: fetch → advance checkpoint → process (loses events on crash).

Pipeline per message (W2 history/messages → W3 classify/match → state →
store):
    fetch_message → normalize_message → save_normalized_email (persist raw)
    → classify → confidence_tier → match_email → resolve target state →
    apply legal transition (auto tier) or queue REVIEW (review / illegal) →
    update_processing_status → aggregate.

Public surface (wired by W4_CLI / W5 watchdog):
    run_sync         one full pass: bootstrap OR incremental change window
    replay_message   reprocess a single message with the current pipeline
    replay_since     reprocess a date window with the current pipeline
    get_status       heartbeat / status dict (``gmail status``, watchdog)

Design rules:
    * Crash-safe checkpoint: advanced only when the window processed with
      ZERO failures; a partial bootstrap (any failure) writes NO new
      checkpoint so the next run re-bootstraps and retries the failed ids.
    * Idempotent: already-``processed`` messages with an unchanged body
      hash are skipped; every audit event id is deterministic so re-runs
      never duplicate the trail.
    * Per-message isolation: one failing email never aborts the window;
      it is dead-lettered and counted, and the checkpoint stays put.
    * Logging: machine events go to ``events.jsonl``, unprocessable
      payloads to ``dead-letter.jsonl`` (3-layer logging, bar.md § Logging).
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from gmail_agent import state_machine
from gmail_agent.classifier import classify_email, confidence_tier
from gmail_agent.config import get_settings
from gmail_agent.db import get_connection, init_db
from gmail_agent.history import (
    DEFAULT_ACCOUNT,
    extract_history_id,
    extract_message_ids,
    get_changes,
    load_checkpoint,
    load_sync_state,
    save_checkpoint,
)
from gmail_agent.logging_config import log_dead_letter, log_event
from gmail_agent.matcher import match_email
from gmail_agent.messages import fetch_message, list_message_ids, normalize_message
from gmail_agent.models import (
    ApplicationEvent,
    ClassificationResult,
    MatchResult,
    NormalizedEmail,
    SyncState,
)
from gmail_agent.store import (
    STATUS_FAILED,
    STATUS_PROCESSED,
    STATUS_UNPROCESSED,
    count_events_by_type,
    count_messages_by_status,
    get_all_applications,
    get_latest_event_time,
    get_processing_status,
    get_recent_failed_messages,
    save_application,
    save_application_event,
    save_classification,
    save_match,
    save_normalized_email,
    update_processing_status,
)

# Audit-trail event_type written for the human review queue (W4_REVIEW
# reads these; the engine never transitions on their behalf). REVIEW events
# carry the proposed event/state in their evidence JSON.
REVIEW_EVENT_TYPE = "REVIEW"

# Prefix for deterministic REVIEW event ids so replays are idempotent.
_REVIEW_ID_PREFIX = "review:"


@dataclass
class ProcessOutcome:
    """What happened to one message on one pass through the pipeline."""

    message_id: str
    status: str = STATUS_PROCESSED  # processed | failed | skipped
    tier: str = "ignore"  # auto | review | ignore
    event_type: str = "NONE"
    application_id: str | None = None
    transitioned: bool = False
    needs_review: bool = False
    events_written: int = 0  # application_events rows persisted
    reason: str = ""
    checkpoint_advanced: bool = False
    last_history_id: str | None = None
    last_successful_sync: datetime | None = None


def _open_conn(conn: sqlite3.Connection | None) -> tuple[sqlite3.Connection, bool]:
    """Return a usable connection and whether this call owns it."""
    if conn is not None:
        return conn, False
    c = get_connection(get_settings().database_path)
    init_db(c)
    return c, True


def _log_paths(
    events_log: Path | None, dead_letter_log: Path | None
) -> tuple[Path, Path]:
    """Resolve explicit log paths, defaulting to the configured ones."""
    settings = get_settings()
    return (
        events_log or settings.events_log_path,
        dead_letter_log or settings.dead_letter_log_path,
    )


# ── core per-message pipeline ────────────────────────────────────────


def _process_message(
    service: Any,
    message_id: str,
    conn: sqlite3.Connection,
    events_log: Path,
    dead_letter_log: Path,
) -> ProcessOutcome:
    """Run the full pipeline on one message id (crash-safe ordering).

    Returns an outcome; never raises for per-message trouble (dead-letter
    + count instead). SQLite-level errors in the store layer still
    propagate — those mean the engine is miswired, not that the email is
    unprocessable.
    """
    outcome = ProcessOutcome(message_id=message_id, status=STATUS_FAILED)

    # Persist raw FIRST (crash-safety: never process before the raw event
    # is durable). fetch/normalize failures have no durable row yet, but a
    # valid-envelope email is saved before any downstream stage runs.
    try:
        raw = fetch_message(service, message_id)
        email = normalize_message(raw)
    except (RuntimeError, ValueError) as exc:
        outcome.reason = f"{type(exc).__name__}: {exc}"
        log_dead_letter(
            dead_letter_log,
            {"message_id": message_id, "reason": outcome.reason, "stage": "fetch/normalize"},
        )
        return outcome

    save_normalized_email(email, conn=conn)

    # Idempotent skip: a message that is already fully processed with an
    # unchanged body hash must not be reclassified on a re-fetch. (A body-
    # hash change already reset the row to 'unprocessed' inside
    # save_normalized_email.)
    if get_processing_status(message_id, conn=conn) == STATUS_PROCESSED:
        outcome.status = "skipped"
        outcome.reason = "already_proccessed_unchanged"
        return outcome

    # ── classify ─────────────────────────────────────────────────────
    classification = classify_email(email)
    save_classification(message_id, classification, conn=conn)
    outcome.event_type = classification.event_type

    settings = get_settings()
    tier = confidence_tier(
        classification.confidence,
        settings.auto_threshold,
        settings.review_threshold,
    )
    outcome.tier = tier

    if tier == "ignore":
        update_processing_status(message_id, STATUS_PROCESSED, conn=conn)
        outcome.status = STATUS_PROCESSED
        outcome.reason = f"low confidence {classification.confidence:.2f}"
        log_event(
            events_log,
            {
                "kind": "message_processed",
                "message_id": message_id,
                "event_type": outcome.event_type,
                "tier": tier,
                "confidence": classification.confidence,
                "reason": outcome.reason,
            },
        )
        return outcome

    # ── match ────────────────────────────────────────────────────────
    applications = get_all_applications(conn=conn)
    match = match_email(email, applications)
    if match is None:
        update_processing_status(message_id, STATUS_PROCESSED, conn=conn)
        outcome.status = STATUS_PROCESSED
        outcome.reason = "no_application_matched"
        log_event(
            events_log,
            {
                "kind": "message_processed",
                "message_id": message_id,
                "event_type": outcome.event_type,
                "tier": tier,
                "confidence": classification.confidence,
                "reason": outcome.reason,
            },
        )
        return outcome

    save_match(message_id, match, conn=conn)
    outcome.application_id = match.application_id
    outcome.events_written += 1  # MATCH event

    target = state_machine.EVENT_TO_STATE.get(classification.event_type)
    if target is None:
        update_processing_status(message_id, STATUS_PROCESSED, conn=conn)
        outcome.status = STATUS_PROCESSED
        outcome.reason = "no_state_target_for_event"
        return outcome

    current_status = _current_status(applications, match.application_id)

    if tier == "auto" and state_machine.can_transition(current_status, target):
        applied = state_machine.apply_transition(current_status, target)
        if applied != current_status:
            save_application(
                {"application_id": match.application_id, "status": applied}, conn=conn
            )
        _write_domain_event(message_id, match, classification, applied, current_status)
        outcome.events_written += 1  # domain event
        outcome.transitioned = applied != current_status
        outcome.status = STATUS_PROCESSED
        outcome.reason = f"auto transition {current_status} -> {applied}"
    else:
        # review tier, OR a confident event that cannot legally transition
        # (e.g. OFFER after REJECTED). Queue for the human — never force.
        _write_review_event(
            message_id,
            match,
            classification,
            target,
            current_status,
            reason="statement_tier" if tier == "review" else "illegal_transition",
        )
        outcome.events_written += 1  # REVIEW event
        outcome.needs_review = True
        outcome.status = STATUS_PROCESSED
        outcome.reason = f"queued for review ({outcome.event_type} -> {target})"

    update_processing_status(message_id, STATUS_PROCESSED, conn=conn)
    log_event(
        events_log,
        {
            "kind": "message_processed",
            "message_id": message_id,
            "event_type": outcome.event_type,
            "tier": tier,
            "confidence": classification.confidence,
            "application_id": match.application_id,
            "reason": outcome.reason,
        },
    )
    return outcome


def _current_status(applications: list[dict[str, Any]], application_id: str) -> str:
    """Return the tracker's current status for an application (APPLIED by default)."""
    for app in applications:
        if str(app.get("application_id", "")) == application_id:
            return str(app.get("status", "")) or "APPLIED"
    return "APPLIED"


def _evidence_json(classification: ClassificationResult, match: MatchResult, **extra: Any) -> str:
    """Compose the human-readable + machine-readable evidence JSON for an event."""
    payload: dict[str, Any] = {
        "classification": classification.evidence,
        "match_level": match.match_level.value,
        "match_evidence": match.evidence,
    }
    payload.update(extra)
    return json.dumps(payload, ensure_ascii=False)


def _write_domain_event(
    message_id: str,
    match: MatchResult,
    classification: ClassificationResult,
    to_state: str,
    from_state: str,
    conn: sqlite3.Connection | None = None,
) -> str:
    """Write the domain event (REJECTION/OFFER/…) for an auto transition."""
    event = ApplicationEvent(
        event_id=f"{classification.event_type}:{message_id}:{match.application_id}",
        gmail_message_id=message_id,
        application_id=match.application_id,
        event_type=classification.event_type,
        confidence=classification.confidence,
        evidence=_evidence_json(
            classification,
            match,
            from_state=from_state,
            to_state=to_state,
            tier="auto",
        ),
    )
    return save_application_event(event, conn=conn)


def _write_review_event(
    message_id: str,
    match: MatchResult,
    classification: ClassificationResult,
    proposed_state: str,
    current_status: str,
    reason: str,
    conn: sqlite3.Connection | None = None,
) -> str:
    """Queue one message for the human review queue (no transition)."""
    event = ApplicationEvent(
        event_id=f"{_REVIEW_ID_PREFIX}{message_id}:{match.application_id}",
        gmail_message_id=message_id,
        application_id=match.application_id,
        event_type=REVIEW_EVENT_TYPE,
        confidence=classification.confidence,
        evidence=_evidence_json(
            classification,
            match,
            proposed_event_type=classification.event_type,
            proposed_state=proposed_state,
            current_status=current_status,
            reason=reason,
        ),
    )
    return save_application_event(event, conn=conn)


# ── public sync surface ──────────────────────────────────────────────


def run_sync(
    service: Any,
    conn: sqlite3.Connection | None = None,
    *,
    max_pages: int | None = None,
    events_log: Path | None = None,
    dead_letter_log: Path | None = None,
) -> SyncResult:
    """Run one full sync pass: bootstrap or an incremental change window.

    * No checkpoint yet → bootstrap: list ``newer_than:Nd`` (configurable
      lookback), process every id, then checkpoint at the profile
      historyId — only when the window had zero failures.
    * Checkpoint present → ``get_changes`` since it, process the new
      message ids, then advance to the newest historyId observed — only
      when the window had zero failures. Failed ids stay on the old
      checkpoint and are retried next pass.

    Returns the aggregate ``SyncResult``.
    """
    conn, owns = _open_conn(conn)
    result = SyncResult()
    events_log, dead_letter_log = _log_paths(events_log, dead_letter_log)
    now = datetime.now(timezone.utc)
    try:
        checkpoint = load_checkpoint(conn=conn)

        if not checkpoint:
            # ── bootstrap ────────────────────────────────────────────
            ids = list_message_ids(
                service,
                query=f"newer_than:{get_settings().lookback_days}d",
                max_pages=max_pages,
            )
            result.messages_seen = len(ids)
            for message_id in ids:
                outcome = _process_message(service, message_id, conn, events_log, dead_letter_log)
                _merge_outcome(result, outcome)
            if result.messages_failed == 0:
                history_id = _profile_history_id(service)
                save_checkpoint(
                    SyncState(
                        account=DEFAULT_ACCOUNT,
                        last_history_id=history_id,
                        last_sync_at=now,
                        last_successful_sync=now,
                    ),
                    conn=conn,
                )
                result.checkpoint_advanced = True
                result.last_history_id = history_id
                result.last_successful_sync = now
            return result

        # ── incremental ─────────────────────────────────────────────
        records = get_changes(service, checkpoint, max_pages=max_pages)
        ids = extract_message_ids(records)
        result.messages_seen = len(ids)
        for message_id in ids:
            outcome = _process_message(service, message_id, conn, events_log, dead_letter_log)
            _merge_outcome(result, outcome)

        if result.messages_failed == 0:
            new_history_id = extract_history_id(records) or checkpoint
            save_checkpoint(
                SyncState(
                    account=DEFAULT_ACCOUNT,
                    last_history_id=new_history_id,
                    last_sync_at=now,
                    last_successful_sync=now,
                ),
                conn=conn,
            )
            result.checkpoint_advanced = True
            result.last_history_id = new_history_id
            result.last_successful_sync = now
        return result
    finally:
        if owns:
            conn.close()


def replay_message(
    service: Any,
    message_id: str,
    conn: sqlite3.Connection | None = None,
    *,
    events_log: Path | None = None,
    dead_letter_log: Path | None = None,
) -> ProcessOutcome:
    """Reprocess a single message with the current classifier/matcher.

    Resets the message to ``unprocessed`` first so an already-processed
    message is not skipped; deterministic event ids keep the audit trail
    duplicate-free on re-run.
    """
    conn, owns = _open_conn(conn)
    events_log, dead_letter_log = _log_paths(events_log, dead_letter_log)
    try:
        update_processing_status(message_id, STATUS_UNPROCESSED, conn=conn)
        return _process_message(service, message_id, conn, events_log, dead_letter_log)
    finally:
        if owns:
            conn.close()


def replay_since(
    service: Any,
    since: datetime,
    conn: sqlite3.Connection | None = None,
    *,
    max_pages: int | None = None,
    events_log: Path | None = None,
    dead_letter_log: Path | None = None,
) -> SyncResult:
    """Reprocess every message received on/after ``since``.

    Lists matching ids via the ``after:`` Gmail query and replays each.
    Does NOT move the sync checkpoint — this is a walk back over history,
    not the live cursor.
    """
    conn, owns = _open_conn(conn)
    events_log, dead_letter_log = _log_paths(events_log, dead_letter_log)
    result = SyncResult()
    try:
        snapshot = since.astimezone(timezone.utc).replace(tzinfo=None)
        ids = list_message_ids(
            service,
            query=f"after:{snapshot.date().isoformat()}",
            max_pages=max_pages,
        )
        result.messages_seen = len(ids)
        for message_id in ids:
            update_processing_status(message_id, STATUS_UNPROCESSED, conn=conn)
            outcome = _process_message(service, message_id, conn, events_log, dead_letter_log)
            _merge_outcome(result, outcome)
        return result
    finally:
        if owns:
            conn.close()


def get_status(
    conn: sqlite3.Connection | None = None,
    *,
    service_started: datetime | None = None,
) -> dict[str, Any]:
    """Return the heartbeat/status dict for ``gmail status`` and the watchdog.

    Mirrors the bar's watchdog shape: last_successful_sync, last_gmail_event,
    last_error, last_history_id, service_started, messages_processed /
    messages_failed / needs_review.
    """
    conn, owns = _open_conn(conn)
    try:
        state = load_sync_state(conn=conn)
        counts = count_messages_by_status(conn=conn)
        latest_event = get_latest_event_time(conn=conn)
        recent_failed = get_recent_failed_messages(limit=1, conn=conn)
        return {
            "last_successful_sync": state.last_successful_sync.isoformat()
            if state and state.last_successful_sync
            else None,
            "last_gmail_event": latest_event.isoformat() if latest_event else None,
            "last_error": (recent_failed[0].get("gmail_message_id") if recent_failed else None),
            "last_history_id": state.last_history_id if state else "",
            "service_started": service_started.isoformat() if service_started else None,
            "messages_processed": int(counts.get(STATUS_PROCESSED, 0)),
            "messages_failed": int(counts.get(STATUS_FAILED, 0)),
            "needs_review": count_events_by_type(REVIEW_EVENT_TYPE, conn=conn),
        }
    finally:
        if owns:
            conn.close()


def _merge_outcome(result: SyncResult, outcome: ProcessOutcome) -> None:
    """Fold one message outcome into the aggregate window result."""
    if outcome.status == STATUS_FAILED:
        result.messages_failed += 1
    elif outcome.status == "skipped":
        result.messages_skipped += 1
    else:
        result.messages_processed += 1
    if outcome.transitioned:
        result.applications_updated += 1
    if outcome.needs_review:
        result.needs_review += 1
    result.events_written += outcome.events_written


def _profile_history_id(service: Any) -> str:
    """Fetch the account's current profile historyId for bootstrap checkpointing."""
    try:
        profile = service.users().getProfile(userId="me").execute()
        history_id = profile.get("historyId")
    except Exception as exc:  # noqa: BLE001 — surface bootstrap API trouble
        raise RuntimeError(f"failed to read Gmail profile historyId: {exc}") from exc
    if not history_id:
        raise RuntimeError("Gmail profile returned no historyId (account not ready)")
    return str(history_id)


__all__ = [
    "REVIEW_EVENT_TYPE",
    "ProcessOutcome",
    "SyncResult",
    "run_sync",
    "replay_message",
    "replay_since",
    "get_status",
]