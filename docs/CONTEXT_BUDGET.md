# Context Budget Architecture

Career-Ops should spend model tokens only on work that needs judgment. Scanning,
deduping, dashboard refreshes, file validation, PDF page checks, and status
summaries are deterministic and should run as scripts.

## Default Flow

1. Refresh compact state when profile context is needed:

   ```bash
   node scripts/init-session.mjs --force
   ```

2. Load `data/session-state.json` first.
3. Load the smallest mode file needed for the user intent.
4. Read large files only on demand:
   - `cv.md` for exact CV facts or wording.
   - `config/profile.yml` for identity, address, visa, and target-role details.
   - `modes/_profile.md` for custom scoring and positioning.
   - `article-digest.md` for proof points.
   - `modes/_shared.md` only for global scoring rules not already covered by the selected mode.

## Mode Budgets

| Work type | Default context | Token goal |
| --- | --- | --- |
| Scan | command output only | 0-500 |
| Dashboard/tracker | API/script output only | 0-500 |
| Offer evaluation | session state + JD + `modes/oferta.md` | 3k-6k |
| Auto-pipeline | session state + JD + `modes/auto-pipeline.md` | 4k-8k |
| CV/PDF tailoring | session state + JD + `modes/pdf.md` + selected CV sections | 5k-10k |
| Apply assistant | session state + form snapshot + `modes/apply.md` | 4k-8k |

## Cost Guardrails

- Never read every mode file for a single command.
- Never load `output/`, `reports/`, `examples/`, `dashboard/node_modules/`, or browser profile data into prompts.
- Prefer `node scan.mjs`, `node check-liveness.mjs`, `node merge-tracker.mjs`, and `node generate-pdf.mjs` over agent reasoning.
- Use the dashboard API for metadata and file links instead of asking an agent to re-parse the tracker.
- For continuous discovery, use:

  ```bash
  npm run scan:loop -- --interval-minutes=180
  ```

## BMAD Integration

BMAD is useful for changing the system, not for every job-search operation.

Use BMAD-style artifacts for product and architecture work:
- PRD: desired workflow, dashboard behavior, success metrics.
- Architecture: data contracts, background services, PDF pipeline, dashboard API.
- Stories: scoped implementation tasks.
- QA checklist: page-count checks, tracker integrity, dashboard API health.

Do not route routine scans, evaluations, or PDF generation through BMAD. That
would add prompt overhead without improving the result.

Recommended local mapping from `/home/sanket758/Tools/BMAD`:
- Planning artifacts: `_bmad-output/planning-artifacts/`
- Implementation artifacts: `_bmad-output/implementation-artifacts/`
- Test artifacts: `_bmad-output/test-artifacts/`

Career-Ops can reference those artifacts when designing new features, but the
runtime command path remains scripts first, agent reasoning second.
