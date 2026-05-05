# Scripts Directory Index

This directory contains all project scripts for scanning, evaluation, PDF generation, and system maintenance.

| File | Description |
|------|-------------|
| `scan.mjs` | Main job portal scanner (zero-token). |
| `init-session.mjs` | Initializes the compact session state for AI agents. |
| `generate-pdf.mjs` | Converts HTML CVs/CLs to PDF. |
| `generate-cover-letter-pdf.mjs` | Specialized PDF generator for cover letters. |
| `doctor.mjs` | System diagnostics and health checks. |
| `verify-pipeline.mjs` | Verifies data integrity of the pipeline and tracker. |
| `merge-tracker.mjs` | Merges batch-evaluated reports into `applications.md`. |
| `analyze-patterns.mjs` | Analyzes rejection patterns and success metrics. |
| `followup-cadence.mjs` | Calculates and tracks follow-up timings. |
| `check-liveness.mjs` | Verifies if job postings are still active. |
| `normalize-statuses.mjs` | Ensures application statuses follow canonical states. |
| `dedup-tracker.mjs` | Removes duplicate entries from `applications.md`. |
| `cv-sync-check.mjs` | Checks if the generated CV is in sync with `cv.md`. |
| `update-system.mjs` | Manages system updates and rollbacks. |
| `explore_fraunhofer.mjs` | Specialized scraper for Fraunhofer. |
| `linkedin_scan.py` | LinkedIn job scanner. |
| `gmail_sync.py` | Core Gmail sync logic. |
| `career_ops_cli.py` | CLI entry point for career-ops. |
| `swarm_task.py` | Multi-agent swarm orchestration. |
| `fraunhofer/` | Folder for Fraunhofer-specific utilities. |
