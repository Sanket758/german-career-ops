# Root Directory Index

This directory is the root of the `career-ops` repository.

| File / Directory | Description |
|------------------|-------------|
| `AGENTS.md` | Core instructions and operational setup for AI coding agents (OpenCode, general agents). |
| `CLAUDE.md` | Core instructions and operational setup for Claude Code. |
| `GEMINI.md` | Core instructions and operational setup for Gemini CLI and Antigravity. |
| `HERMES.md` | Core instructions and operational setup for Hermes Agent. |
| `package.json` | Project scripts and Node.js dependencies (`npm run doctor`, `npm run github:inventory`, etc.). |
| `build_resume.sh` | Top-level script to build and verify user resume PDFs. |
| `portals.yml` | Scanner configuration for target companies and query portals (copied from template). |
| `config/` | Profile configuration (`profile.example.yml`, `resume-source.example.yml`). |
| `data/` | User-owned data directory (gitignored: applications tracker, pipeline inbox, session state, GitHub inventory). |
| `docs/` | Architecture documentation and agent workflow guides (`docs/agent-workflows/github-inventory.md`). |
| `modes/` | Prompt modes and persona files for evaluation, scanning, deep research, and PDF generation. |
| `resume/` | Bundled single resume builder package (`resume.example.yaml`, `build_resume.py`, `verify_resume.py`). |
| `scripts/` | Deterministic automation scripts (scanning, PDF generation, diagnostics, pipeline integrity). |
| `templates/` | Example configurations and state schemas (`portals.example.yml`, `states.yml`). |
| `reports/` | Detailed evaluation reports (gitignored). |
| `output/` | Generated application letters and PDFs (gitignored). |
| `batch/` | Batch processing inputs, tracker additions, and run logs. |
| `research/` | Standalone research deliverables. `research/berlin-ai-retail/` — Berlin AI + retail/inventory company index with HTTP-checked careers links for the daily scan. |

