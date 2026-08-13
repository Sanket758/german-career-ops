# Bar Reference: Gmail Sync Engine Architecture

Source: User-provided architecture proposal (2026-08-09 conversation).

## Architecture Overview

```
Gmail → watch/history sync → Email Normalizer → Job Email Classifier → Application Matcher → Application Tracker (state machine)
```

## Core Design Principles

1. **Gmail is an event source only** — not responsible for deciding rejections
2. **Tracker is source of truth** for application state
3. **Separate email detection from state transition**
4. **Multi-signal classification** (headers + keywords + LLM) with confidence thresholds
5. **Crash-safe synchronization** with historyId checkpointing
6. **SQLite event store** for audit trail
7. **Human review queue** (high/medium/low confidence tiers)

## Module Structure

```
gmail_agent/
├── auth.py          # OAuth, token refresh, gmail.readonly scope
├── sync.py          # Main loop: get_changes → process → checkpoint
├── history.py       # Gmail History API: history.list(startHistoryId)
├── messages.py      # Gmail Messages API: fetch full message
├── parser.py        # HTML→text, language detection, metadata extraction
├── classifier.py    # Multi-signal: rule score + LLM score + sender evidence → confidence
├── matcher.py       # 5-level cascading: ID → sender+company → subject → body entities → semantic
├── events.py        # Structured event schema + validation
├── reconciler.py    # Periodic full consistency check + dropped-notification recovery
└── models.py        # Pydantic models for events, classifications, matches
```

## Classification Confidence Thresholds

- `>= 0.90` → automatic state transition
- `0.70 - 0.90` → mark "needs review" (human queue)
- `< 0.70` → ignore / archive

## State Machine

```
APPLIED → ACKNOWLEDGED → SCREENING → INTERVIEW → ASSESSMENT → OFFER
                                                        ↘ REJECTED (terminal, manual override only)
```

Legal transitions enforced. REJECTED is terminal unless manually overridden.

## Crash Safety

```
fetch changes → persist raw event → process event → update tracker → commit processed state → advance checkpoint
```

NEVER: fetch → advance checkpoint → process (loses events on crash)

## SQLite Schema

```sql
gmail_messages (gmail_message_id, thread_id, received_at, sender, subject, snippet, body_hash, language, processed_at, classification, classification_confidence, processing_status)
application_events (event_id, gmail_message_id, application_id, event_type, confidence, evidence, created_at)
applications (application_id, company, position, status, applied_at, last_updated, ...)
```

## Sync State

```
gmail_state: account, last_history_id, last_sync_at, last_successful_sync, watch_expiration
```

## Logging (3 layers)

1. Operational: `logs/gmail-service.log`
2. Machine-readable: `logs/events.jsonl`
3. Dead-letter: `logs/dead-letter.jsonl`

## Reprocessing

`gmail replay --message <id>` or `gmail replay --since <date>` — re-run old emails with improved classifier.

## Human Review Queue

```
HIGH CONFIDENCE (≥0.90) → automatic
MEDIUM CONFIDENCE (0.70-0.90) → review queue
LOW CONFIDENCE (<0.70) → ignore
```

## systemd Service

`~/.config/systemd/user/jobtracker-gmail.service` — always running, Restart=always, RestartSec=10.

## Watchdog/Heartbeat

```json
{"last_successful_sync": "...", "last_gmail_event": "...", "last_error": "...", "last_history_id": "...", "service_started": "...", "messages_processed": 1284, "messages_failed": 3, "needs_review": 7}
```

## Reconciliation

- REAL-TIME: notification → history.list → process
- Every 15-60 min: history.list() → verify checkpoint → recover missed events
- Daily: FULL CONSISTENCY CHECK

## German Language Support

Language detection preserves original. Event schema language-independent. Single classifier for all languages.

## What This Replaces

Current: `scripts/gmail_sync.py` (keyword matching → CSV) + `integrations/gmail_bridge.py` (CSV → burn list/tracker)
Proposed: Single event-driven pipeline with audit trail, state machine, and human review.
