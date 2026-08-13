# Gauntlet Graph — Gmail Sync Engine

## Bar: Gmail Sync Engine Architecture (user proposal 2026-08-09)
## Round: 3 — Wave 3 complete (W3_CLASS + W3_MATCH, both critic-passed after repair)

| Piece | Status | Verdict | Gap |
|---|---|---|---|
| W1_FOUND | done | — | — |
| W2_AUTH | done | — | — |
| W2_HISTORY | done | — | — |
| W2_MESSAGES | done | — | — |
| W2_PARSER | done | — | — |
| W2_SQLITE | done | — | — |
| W2_STATE | done | — | — |
| W3_CLASS | done | ours | — |
| W3_MATCH | done | ours | — |
| W4_ENGINE | pending | — | — |
| W4_CLI | pending | — | — |
| W4_REVIEW | pending | — | — |
| W4_RECON | pending | — | — |
| W5_SYSTEMD | pending | — | — |

## Next wave: W4_ENGINE + W4_CLI + W4_REVIEW + W4_RECON (depend on W3)
## Blocked: W5_SYSTEMD (waiting for W4)

Wave 2 complete — full suite 150 passed in `.career-ops-env`:
- W2_STATE: state_machine.py — 22 tests (canonical 9 states, legal transitions, REJECTED terminal, manual override)
- W2_SQLITE: store.py — 18 tests (upsert emails, classification/match/event chain, audit trail, reprocessing)
- W2_AUTH: auth.py — 3 tests (OAuth, token refresh, gmail.readonly)
- W2_HISTORY: history.py — 20 tests (History API polling, pagination, crash-safe checkpoint)
- W2_MESSAGES: messages.py — 23 tests (fetch, MIME body extraction, header parsing)
- W2_PARSER: parser.py — 26 tests (HTML→text, de/en detection, metadata extraction)

Round 3 repair (critic-driven) — full suite 184 passed:
- W3_CLASS critic "ours" + gap: German mandatory job-suffix `(w/m/d)` was a REJECTION keyword → removed + regression test.
- W3_MATCH critic "reference": L2/L3 were merged (no distinct SUBJECT level) and bare ATS sender `noreply@smartrecruiters.com` matched the ATS vendor as the company at 0.90 → matcher now runs distinct L2 SENDER_COMPANY + L3 SUBJECT levels (`extract_sender_company`/`extract_subject_company`); ATS-vendor domains skipped. Both pinned by regression tests.
