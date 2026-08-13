# AGENTS — career-ops

This file captures high-signal guidance for future OpenCode sessions. Every line below answers: "Would an agent likely miss this without help?"

## Setup

```bash
# 1. Install
git clone https://github.com/santifer/career-ops.git
cd career-ops && npm install

# 2. Install Playwright (required for PDF generation)
npx playwright install chromium

# 3. Validate prerequisites
npm run doctor
# → must show all checks passing

# 4. Configure profile
cp config/profile.example.yml config/profile.yml
# → edit with your details (name, location, target roles, comp, visa)

# 5. Configure portals
cp templates/portals.example.yml portals.yml
# → customize companies/queries to scan
```

## Required Files

- `cv.md` in project root — canonical CV; the system will not evaluate without it
- `config/profile.yml` — must be filled in before running pipeline
- `portals.yml` — must exist before `npm run scan`

## Pipeline Integrity — Script Execution Order

Always run in this order (never skip or reorder):

1. **`npm run doctor`** — validate prerequisites
2. **`node scripts/verify-pipeline.mjs`** — health check (statuses, duplicates, report links, score format, row format)
3. **`node scripts/normalize-statuses.mjs`** — normalize all statuses to canonical values
4. **`node scripts/dedup-tracker.mjs`** — deduplicate entries
5. **`node scripts/merge-tracker.mjs`** — merge batch tracker additions

> **Never edit `applications.md` directly** to add new entries. Write TSV files in `batch/tracker-additions/` and run `merge-tracker.mjs` to handle the merge.

## Update Check

On first message of each session:

```bash
node scripts/update-system.mjs check
```

- `update-available` → tell the user and ask if they want to apply (`apply` rolls forward, `rollback` rolls back)
- `up-to-date` → say nothing
- `dismissed` → say nothing

## Key Directories

| Directory | Purpose |
|---|---|
| `data/` | Tracking data (gitignored) — applications.md, pipeline.md, session-state.json |
| `reports/` | Evaluation reports (gitignored) |
| `output/` | Generated PDFs (gitignored) |
| `batch/tracker-additions/` | New entries TSVs — merged into applications.md via merge-tracker.mjs |
| `batch/merged/` | Processed TSVs moved after merge |
| `modes/` | Evaluation modes and archetypes; `_shared.md` = system, `_profile.md` = user customization |
| `config/` | profile.yml (user data), profile.example.yml (template) |
| `templates/` | portals.example.yml, states.yml, cv-template.html |

## Playwright Location

Playwright is installed locally within the `.career-ops-env` virtual environment (UV Python). If PDF generation fails, re-run `npx playwright install chromium`.

## Pending German PDFs

4 German CV PDFs are pending regeneration from /tmp into output/:
- cv-sanket-sap-de.html
- cv-sanket-carbmee-de.html
- cv-sanket-eternal.ag-de.html
- cv-sanket-quantum.systems-de.html

These were generated with photos removed (photo-free). Regenerate via: `node scripts/generate-pdf.mjs` or `/career-ops pdf`.

## Code RED Status

The system is in "CODE RED" mode (per brain hot.md): full-time job search only, Masters ends 28 Aug 2026, full-time authorized Germany-wide, junior/mid level, €50-65K target. Any agent session should first run `node scripts/update-system.mjs check` and validate prerequisites with `npm run doctor`.

## CV Photo Policy (from brain)

- **Tech CVs**: Photo OFF — AGG/GDPR make it legal+optional; tech culture is photo-optional
- **Mittelstand/financial apps**: Photo can be kept for future use
- The 4 pending German CVs had photos removed and were regenerated photo-free into /tmp; PDFs need to be re-generated into output/