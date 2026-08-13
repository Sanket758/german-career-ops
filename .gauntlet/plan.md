# Gauntlet Plan — Gmail Sync Engine

## Goal
Build a full Gmail sync engine that replaces our current keyword-to-tracker pipeline (`scripts/gmail_sync.py` + `integrations/gmail_bridge.py`).

## Bar Reference
`.gauntlet/bar/bar.md` — 20-point architecture spec from user proposal.

## Pieces (independently judgeable)

### Wave 1 — Foundation (sequential gate)
| ID | Piece | Success Criteria | Est. |
|---|---|---|---|
| `W1_FOUND` | Project structure, Pydantic models, config/settings, logging setup, directory layout | `gmail_agent/` package imports cleanly; models validate; 3-layer logging works | Medium |

### Wave 2 — Core Modules (parallel, depend only on W1)
| ID | Piece | Success Criteria | Est. |
|---|---|---|---|
| `W2_AUTH` | OAuth, token refresh, `gmail.readonly` scope, credential persistence | Can authenticate and get Gmail service object | Low |
| `W2_HISTORY` | `history.list(startHistoryId)`, polling loop, crash-safe checkpoint (persist raw event → process → commit → advance) | Fetches only new changes since last checkpoint; survives crash without losing events | High |
| `W2_MESSAGES` | Full message fetch, MIME body extraction, header parsing | Returns structured NormalizedEmail with subject/sender/date/body | Medium |
| `W2_PARSER` | HTML→text, language detection, metadata extraction | Clean plain text from any email; detects de/en; extracts company/role signals | Medium |
| `W2_SQLITE` | SQLite schema (3 tables), CRUD operations, audit trail inserts | Tables created; events inserted with evidence; reprocessable | Medium |
| `W2_STATE` | State machine: legal transitions, REJECTED terminal, manual override | Rejects illegal transitions (e.g., REJECTED → INTERVIEW); allows manual override | Low |

### Wave 3 — Intelligence Layer (depend on W2)
| ID | Piece | Success Criteria | Est. |
|---|---|---|---|
| `W3_CLASS` | Multi-signal classifier: rule score + LLM score + sender evidence → confidence; thresholds (≥0.90 auto, 0.70-0.90 review, <0.70 ignore) | Classifies test emails with confidence scores; German + English work | High |
| `W3_MATCH` | 5-level cascading matcher: explicit ID → sender+company → subject → body entities → semantic similarity | Correctly links emails to existing applications; handles noreply@smartrecruiters.com case | High |

### Wave 4 — Orchestration (depends on W3)
| ID | Piece | Success Criteria | Est. |
|---|---|---|---|
| `W4_ENGINE` | Main sync engine: orchestrates W2_history → W2_msgs → W2_parser → W3_class → W3_match → W2_state → W2_sqlite; crash-safe checkpointing | End-to-end: Gmail → classified+matched events → tracker updates + audit trail | High |
| `W4_CLI` | CLI: `gmail sync`, `gmail replay --message/--since`, `gmail status` | Commands work; replay reprocesses old emails with current classifier | Medium |
| `W4_REVIEW` | Human review queue: confidence-tiered UI data, `[Reject] [Keep Active] [Inspect Email]` actions | Medium-confidence events queued; manual decisions update tracker + become training data | Medium |
| `W4_RECON` | Reconciler: periodic checkpoint verification + dropped-notification recovery + daily full consistency check | Recovers missed events from history; daily check finds orphan applications | Medium |

### Wave 5 — Deployment (depends on W4)
| ID | Piece | Success Criteria | Est. |
|---|---|---|---|
| `W5_SYSTEMD` | systemd user service unit, install script, watchdog heartbeat | Service starts, restarts on failure, exposes heartbeat JSON | Low |

## Dependency Graph
```
W1_FOUND → {W2_AUTH, W2_HISTORY, W2_MESSAGES, W2_PARSER, W2_SQLITE, W2_STATE}
W2_AUTH → {W2_HISTORY, W2_MESSAGES}
W2_HISTORY + W2_MESSAGES + W2_PARSER → W3_CLASS
W2_SQLITE + W3_CLASS → W3_MATCH
W2_STATE + W3_CLASS + W3_MATCH → W4_ENGINE
W4_ENGINE → {W4_CLI, W4_REVIEW, W4_RECON}
W4_CLI → W5_SYSTEMD
```

## Parallelization Summary
| Wave | Pieces | Parallelism |
|---|---|---|
| 1 | 1 | sequential gate |
| 2 | 6 | all parallel |
| 3 | 2 | parallel (need W2) |
| 4 | 4 | parallel (need W3) |
| 5 | 1 | sequential |

## Verification Strategy
- Each wave has a Verifier run objective checks (imports, unit tests, integration tests)
- Each piece gets a Critic blind comparison against the corresponding bar section
- End-to-end test: run engine against a test Gmail account with known emails, verify tracker updates + audit trail
