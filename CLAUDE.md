# Career-Ops -- AI Job Search Pipeline

## Origin

This system was built and used by [santifer](https://santifer.io) to evaluate 740+ job offers, generate 100+ tailored CVs, and land a Head of Applied AI role. The archetypes, scoring logic, negotiation scripts, and proof point structure all reflect his specific career search in AI/automation roles.

The portfolio that goes with this system is also open source: [cv-santiago](https://github.com/santifer/cv-santiago).

**It will work out of the box, but it's designed to be made yours.** If the archetypes don't match your career, the modes are in the wrong language, or the scoring doesn't fit your priorities -- just ask. You (AI Agent) can edit the user's files. The user says "change the archetypes to data engineering roles" and you do it. That's the whole point.

## Data Contract (CRITICAL)

There are two layers. Read `docs/DATA_CONTRACT.md` for the full list.

**User Layer (NEVER auto-updated, personalization goes HERE):**
- `cv.md`, `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, `portals.yml`
- `data/*`, `reports/*`, `output/*`, `interview-prep/*`

**System Layer (auto-updatable, DON'T put user data here):**
- `modes/_shared.md`, `modes/oferta.md`, all other modes
- `CLAUDE.md`, `scripts/*.mjs`, `dashboard/*`, `templates/*`, `batch/*`

**THE RULE: When the user asks to customize anything (archetypes, narrative, negotiation scripts, proof points, location policy, comp targets), ALWAYS write to `modes/_profile.md` or `config/profile.yml`. NEVER edit `modes/_shared.md` for user-specific content.** This ensures system updates don't overwrite their customizations.

## Token Optimization Mandate

**CRITICAL**: This project uses a directory indexing strategy to reduce AI token usage.
1. **Always check for `DIR_INDEX.md`** when entering a new directory. 
2. Use the index to identify relevant files instead of performing multiple `list_directory` or `read_file` calls.
3. If you create a new file, update the corresponding `DIR_INDEX.md`.

## Update Check

On the first message of each session, run the update checker silently:

```bash
node scripts/update-system.mjs check
```

Parse the JSON output:
- `{"status": "update-available", "local": "1.0.0", "remote": "1.1.0", "changelog": "..."}` → tell the user:
  > "career-ops update available (v{local} → v{remote}). Your data (CV, profile, tracker, reports) will NOT be touched. Want me to update?"
  If yes → run `node scripts/update-system.mjs apply`. If no → run `node scripts/update-system.mjs dismiss`.
- `{"status": "up-to-date"}` → say nothing
- `{"status": "dismissed"}` → say nothing
- `{"status": "offline"}` → say nothing

The user can also say "check for updates" or "update career-ops" at any time to force a check.
To rollback: `node scripts/update-system.mjs rollback`

## What is career-ops

AI-powered job search automation built on Claude Code: pipeline tracking, offer evaluation, CV generation, portal scanning, batch processing.

### Main Files

| File | Function |
|------|----------|
| `data/applications.md` | **Canonical Tracker**: Application status overview. |
| `data/pipeline.md` | **Inbox**: Pending URLs for processing. |
| `data/session-state.json` | Compact profile/session summary. |
| `scripts/init-session.mjs` | Generates the session state. |
| `scripts/scan.mjs` | Zero-token portal scanner. |
| `scripts/generate-pdf.mjs` | HTML to PDF converter (Playwright). |
| `scripts/doctor.mjs` | System diagnostics. |
| `config/profile.yml` | User profile and targeting config. |
| `portals.yml` | Scanner configuration. |
| `cv.md` | **Canonical CV**: Source of truth for experience. |
| `reports/` | Detailed evaluation reports (A-F scoring). |

### Context Budget Routing

Default to a two-tier context strategy:

1. **Deterministic commands:** scan, tracker, dashboard refresh, Gmail sync, liveness checks, PDF page validation, dedup/merge, and follow-up calculations should run scripts in `scripts/` directly. 
2. **Reasoning commands:** evaluation, auto-pipeline, tailored CV/cover-letter writing, application answers, and company research may read the relevant mode file plus source data. Prefer `data/session-state.json` first.

Before a reasoning command, refresh compact context when stale:

```bash
node scripts/init-session.mjs --force
```

### OpenCode Commands

When using [OpenCode](https://opencode.ai), the following slash commands are available (defined in `.opencode/commands/`):

| Command                | Claude Code Equivalent | Description                                      |
| ---------------------- | ---------------------- | ------------------------------------------------ |
| `/career-ops`          | `/career-ops`          | Show menu or evaluate JD with args               |
| `/career-ops-pipeline` | `/career-ops pipeline` | Process pending URLs from inbox                  |
| `/career-ops-evaluate` | `/career-ops oferta`   | Evaluate job offer (A-F scoring)                 |
| `/career-ops-compare`  | `/career-ops ofertas`  | Compare and rank multiple offers                 |
| `/career-ops-contact`  | `/career-ops contacto` | LinkedIn outreach (find contacts + draft)        |
| `/career-ops-deep`     | `/career-ops deep`     | Deep company research                            |
| `/career-ops-pdf`      | `/career-ops pdf`      | Generate ATS-optimized CV                        |
| `/career-ops-training` | `/career-ops training` | Evaluate course/cert against goals               |
| `/career-ops-project`  | `/career-ops project`  | Evaluate portfolio project idea                  |
| `/career-ops-tracker`  | `/career-ops tracker`  | Application status overview                      |
| `/career-ops-apply`    | `/career-ops apply`    | Live application assistant                       |
| `/career-ops-scan`     | `/career-ops scan`     | Scan portals for new offers                      |
| `/career-ops-batch`    | `/career-ops batch`    | Batch processing with parallel workers           |
| `/career-ops-patterns` | `/career-ops patterns` | Analyze rejection patterns and improve targeting |
| `/career-ops-followup` | `/career-ops followup` | Follow-up cadence tracker                        |

**Note:** OpenCode commands invoke the same `.claude/skills/career-ops/SKILL.md` skill used by Claude Code. The `modes/*` files are shared between both platforms.

### Pipeline Integrity

1. **NEVER edit applications.md to ADD new entries** -- Write TSV in `batch/tracker-additions/` and `scripts/merge-tracker.mjs` handles the merge.
2. Health check: `node scripts/verify-pipeline.mjs`
3. Normalize statuses: `node scripts/normalize-statuses.mjs`
4. Dedup: `node scripts/dedup-tracker.mjs`

**Playwright Location:**  
Playwright is installed locally within the `.career-ops-env` virtual environment (UV python).
