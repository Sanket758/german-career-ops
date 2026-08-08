# Mode: full — One-Command Full Workflow

Runs the ENTIRE pipeline in one command: scan → evaluate → pipeline → PDF → tracker (via Gmail).

## Workflow

1. **Scan** — Run `node scripts/scan.mjs` (zero-token portal scanner). New offers are appended to `data/pipeline.md` Pending section. If 0 new offers, report and continue (Gmail sync still runs).
2. **Pipeline** — Read `data/pipeline.md` Pending items (`- [ ]`). For each pending URL, execute the full auto-pipeline (read `modes/auto-pipeline.md`): extract JD → A-F evaluation → save report to `reports/` → generate PDF if score >= 3.0 → write tracker TSV addition to `batch/tracker-additions/` → merge with `node scripts/merge-tracker.mjs`. Move processed items to Processed section.
   - Adaptive execution: if 3+ pending URLs and using cloud models, launch parallel subagents; if local models, process sequentially in main thread (per `modes/pipeline.md`).
3. **PDF** — For each evaluated offer with score >= 3.0, ensure the ATS-optimized CV PDF exists in `output/` (generated during pipeline step; verify presence, regenerate if missing).
4. **Tracker via Gmail** — Run the Gmail sync to update application statuses from emails:
   - `python3 scripts/gmail_sync.py` (upstream sync; requires `token.json` + `credentials.json` or `GMAIL_CREDS_PATH`)
   - If the Germany bridge is set up: `source .career-ops-env/bin/activate && python3 integrations/gmail_bridge.py` (also updates burn-list.tsv)
   - This catches "applied through email" confirmations and updates tracker statuses (Applied/Interview/Offer/Rejected).
5. **Summary** — Print a final table: | # | Company | Role | Score | PDF | Status | Recommended Action |

## Notes
- Never write directly into `data/applications.md` — route additions through `batch/tracker-additions/` TSV + `node scripts/merge-tracker.mjs` (data contract).
- If Gmail OAuth is not set up (no token.json), skip Step 4 with a warning and continue.
- If scan finds 0 new offers, still run Gmail sync (statuses may have changed).
