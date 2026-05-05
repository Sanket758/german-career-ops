# Codex Setup

Career-Ops supports Codex through the root `AGENTS.md` file.

If your Codex client reads project instructions automatically, `AGENTS.md`
is enough for routing and behavior. Codex should reuse the same checked-in
mode files, templates, tracker flow, and scripts that already power the
Claude workflow.

## Prerequisites

- A Codex client that can work with project `AGENTS.md`
- Node.js 18+
- Playwright Chromium installed for PDF generation and reliable job verification
- Go 1.21+ if you want the TUI dashboard

## Install

```bash
npm install
npx playwright install chromium
```

## Recommended Starting Prompts

- `Evaluate this job URL with Career-Ops and run the full pipeline.`
- `Scan my configured portals for new roles that match my profile.`
- `Generate the tailored ATS PDF for this role using Career-Ops.`

## Routing Map

| User intent | Files Codex should read |
|-------------|-------------------------|
| Raw JD text or job URL | `data/session-state.json` + `modes/auto-pipeline.md`; read shared/profile/CV files only on demand |
| Single evaluation only | `data/session-state.json` + `modes/oferta.md` + JD |
| Multiple offers | `data/session-state.json` + `modes/ofertas.md` |
| Portal scan | Run `node scan.mjs`; read command output and `data/pipeline.md` summary only |
| Continuous scan | Run `npm run scan:loop -- --interval-minutes=180` |
| PDF generation | `data/session-state.json` + `modes/pdf.md` + selected CV/profile sections |
| Live application help | `data/session-state.json` + `modes/apply.md` + form snapshot |
| Pipeline inbox processing | `data/session-state.json` + `modes/pipeline.md` + pending URLs |
| Tracker status | Use dashboard API or `data/applications.md` table only |
| Deep company research | `data/session-state.json` + `modes/deep.md` |
| Training / certification review | `data/session-state.json` + `modes/training.md` |
| Project evaluation | `data/session-state.json` + `modes/project.md` |

The key point: Codex support is additive. It should route into the existing
Career-Ops modes and scripts rather than introducing a parallel automation
layer.

See `docs/CONTEXT_BUDGET.md` for the cost-control rules.

## Behavioral Rules

- Treat raw JD text or a job URL as the full auto-pipeline path unless the user explicitly asks for evaluation only.
- Keep all personalization in `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, or `portals.yml`.
- Never verify a job’s live status with generic web fetch when Playwright is available.
- Never submit an application for the user.
- Never add new tracker rows directly to `data/applications.md`; use the TSV addition flow and `merge-tracker.mjs`.

## Verification

```bash
npm run verify

# optional dashboard build
cd dashboard && go build ./...
```
