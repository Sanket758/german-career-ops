# gmail_agent — DIR_INDEX

Gmail sync engine (event-driven pipeline; see `../.gauntlet/bar/bar.md` for
the architecture and schema).

| File | Purpose |
|------|---------|
| `__init__.py` | Package exports (models, settings, logging, db, store, history, messages, classifier, matcher) |
| `auth.py` | W2_AUTH: OAuth 2.0 (gmail.readonly), token refresh, `get_gmail_service()` |
| `classifier.py` | W3_CLASS: multi-signal classification (rule + sender + optional LLM) → `ClassificationResult`, auto/review/ignore tiers |
| `config.py` | Pydantic-settings; env-compatible with legacy `scripts/gmail_sync.py` |
| `db.py` | W1: `get_connection()` (Row factory + WAL) and `init_db()` schema |
| `history.py` | W2_HISTORY: Gmail History API change-fetch (pagination) + crash-safe `gmail_state` checkpointing |
| `logging_config.py` | W1: 3-layer logging (operational / events.jsonl / dead-letter) |
| `matcher.py` | W3_MATCH: 5-level cascading application matcher (ID → sender+company → subject → body entities → semantic) |
| `messages.py` | W2_MESSAGES: Gmail message fetch + normalization to `NormalizedEmail` (MIME body walker, header/date extraction, stopgap language heuristic) |
| `models.py` | W1: Pydantic data contract (`NormalizedEmail`, `ClassificationResult`, `MatchResult`, `ApplicationEvent`, `SyncState`) |
| `parser.py` | W2_PARSER: pure text cleaning, language detection, metadata extraction (company/role/application id) |
| `state_machine.py` | W2_STATE: legal tracker transitions (APPLIED→…→OFFER, terminal REJECTED/WITHDRAWN/HIRED) |
| `store.py` | W2_SQLITE: CRUD + audit-trail event store over the W1 schema |

Waves not yet built (future): sync, events, reconciler, engine (W4).
