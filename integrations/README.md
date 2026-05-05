# Career-Ops Germany — Integrations

## Gmail Sync Bridge

Connects the upstream `gmail_sync.py` to the career-ops-germany data layer.

### What it does

```
Gmail Inbox
    ↓ (gmail_sync.py — upstream)
data/applications.csv + data/rejections.csv
    ↓ (gmail_bridge.py — this integration)
career-ops-germany/data/applications.md  ← tracker update
career-ops-germany/data/burn-list.tsv    ← rejection → 6-month cooldown
```

### Setup

1. Ensure `GMAIL_CREDS_PATH` env var is set (Google OAuth credentials)
2. Ensure `token.json` exists at project root (run `gmail_sync.py` once to generate)

### Usage

```bash
# Full sync: Gmail → upstream → Germany tracker + burn list
source .career-ops-env/bin/activate
python career-ops-germany/integrations/gmail_bridge.py

# Or with uv:
uv run python career-ops-germany/integrations/gmail_bridge.py
```

### Standalone Rejection Parser

If you don't have Gmail OAuth set up, you can still backfill the burn list
from any manually-updated rejections in the tracker:

```bash
# Dry run (preview only):
uv run python career-ops-germany/integrations/rejection_parser.py --dry-run

# Actual run:
uv run python career-ops-germany/integrations/rejection_parser.py
```

### How the Burn List Works

| Event | Action |
| ----- | ------ |
| Gmail detects rejection email | `gmail_bridge.py` adds company to `burn-list.tsv` |
| You manually set status to "Rejected" in tracker | `rejection_parser.py` backfills `burn-list.tsv` |
| Scanner finds a new role at burned company | Shows ⚠️ warning (does NOT silently skip) |
| Evaluator scores a burned company's role | Applies **-2.5 penalty** to global score |
| Reapply window opens (6 months) | Status changes from 🔴 BLOCKED → 🟢 CLEAR |

### Files

| File | Purpose |
| ---- | ------- |
| `gmail_bridge.py` | Full Gmail → tracker + burn list pipeline |
| `rejection_parser.py` | Standalone tracker → burn list backfill |
| `README.md` | This file |
