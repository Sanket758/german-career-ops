# Plan — French Robotics Startups List → Job-Search Pipeline

**Date:** 2026-10-21
**Source:** LinkedIn post "Looking for a Job in Robotics? Start with these 37 French Startups" (Boring Sage)
**Scope decision (user-approved):** German-reachable + EU-remote only. France stays excluded in `portals.yml` `location_filter.negative`.

## Why this is filtered

Sanket is Berlin-based, English C1 / German A2 (no French), German MSc → §20 job-seeker
permit → work permit **in Germany, without sponsorship**. France-based on-site roles need
French B1+ *and* French work-permit sponsorship. So a French-only listing is not
actionable. Actionable surface = companies with a **German entity/office** (German postings
pass the location filter, no sponsorship needed) + roles explicitly open to **remote EU**.

## Candidate profile (for fit scoring)

- Stack: Python, PyTorch, YOLOv8, Detectron2, DINOv3 retrieval, OpenCV, FastAPI, Docker, GCP, ROS2, some Nav2/SLAM/Webots
- 4 yrs production ML (FMCG retail CV, shelf monitoring), MSc AI Berlin (2026)
- Level: junior → mid (senior acceptable); PhD-only research roles = skip
- Relevant role types: computer vision, perception, ML/DL, robotics software, SLAM, ROS, autonomy, simulation, Python backend for robotics
- Excluded role types: mechanical/electrical/controls/hardware, sales, marketing, BD, logistics ops, project management

## Steps

1. **Research** — 37 companies split into 5 batches, one research subagent per batch (parallel).
   Each company: German-presence evidence, careers URL + HTTP status + ATS type, open relevant
   roles, EU-remote evidence, French-language requirement, verdict.
   Output: `research/french-robotics/sources/0N-*.md` (one file per batch).
2. **Synthesise** — `research/french-robotics/README.md` (index + per-company evidence),
   `french-robotics-companies.csv`, `portals-block.yml` (mirrors `research/berlin-ai-retail/`).
3. **Wire in** — append TRACK companies to `portals.yml` `tracked_companies` with
   `careers_url` + `scan_method`/`scan_query` + `priority` + `notes`. No change to
   `location_filter` (France stays negative).
4. **Pipeline** — add live, matching, German/EU-remote roles to `data/pipeline.md`.
5. **Verify** — `npm run doctor` → `node scripts/verify-pipeline.mjs` →
   `node scripts/normalize-statuses.mjs` → `node scripts/dedup-tracker.mjs` →
   `node scripts/merge-tracker.mjs`. Confirm exit codes and row counts.
6. **Memory** — store a finding in the vault (`vault_store`) so the next session knows
   the French-robotics surface was already swept.

## Non-goals

- No changes to `config/profile.yml` (no France relocation, no French-language target).
- No rebuild of the LinkedIn bot or the pipeline scripts.
- No applications sent in this pass — this is discovery + wiring only.

---

## Result (2026-10-21)

**Sweep:** 37 companies researched in 5 parallel batches → `sources/0N-*.md` (per-company evidence with quotes and source URLs).

**Verdicts:** **5 TRACK · 11 WATCH · 21 SKIP** (5+11+21 = 37, all accounted for in the CSV).
TRACK = Exotec, EasyMile, Exail, SBG Systems, Genesis AI. German presence **confirmed** for 4 of the 5 (Exotec Deutschland GmbH, EasyMile GmbH, Exail GmbH, SBG Systems' German office + an Augsburg posting); Genesis AI is wired on technical fit, not geography.
Full index: `README.md` · machine-readable: `french-robotics-companies.csv` · wired block: `portals-block.yml`.

**Wired into `portals.yml`** (`tracked_companies`, now 287; 6 targeted `search_queries` added):

| Company | careers_url | ATS | Tier | German evidence |
|---|---|---|---|---|
| Exotec | `https://apply.workable.com/exotec/` | Workable | tier2 | Exotec Deutschland GmbH, München-Flughafen / Landshut |
| EasyMile | `https://easymile.welcomekit.co/` | WelcomeKit | tier2 | EasyMile GmbH, Kastanienallee 84, 10435 Berlin (HRB 193152) |
| Exail | `https://jobs.exail.com/en/annonces` | DigitalRecruiters | tier2 | Exail GmbH, Esplanade 40, 20354 Hamburg (HRB 159940) |
| SBG Systems | `https://career.sbg-systems.com/jobs` | Teamtailor (generic HTML path) | tier2 | German office (2023) + "Junior Sales Engineer DACH", Location: Augsburg |
| Genesis AI | `https://jobs.ashbyhq.com/genesis` | Ashby | tier3 | none — wired on technical fit (Genesis World simulation engine); London roles are dropped by the current location filter, see README |
| SCALLOG | `https://www.welcometothejungle.com/fr/companies/scallog` | WTTJ (websearch fallback) | tier3 | none, but a dedicated Germany push (XPROMA, Decathlon DE) |

**Filter changes** (both make the France exclusion airtight, neither loosens it):
- `title_filter.negative` += `Business Developer` — the sibling of the existing "Business Development"; "Business Developer Leader" at Exotec is a sales role that passed.
- `location_filter.negative` += ~50 French cities (the 37 HQs + main French robotics clusters) so a French place named in a job **title** is caught, not only a country spelled out. Deliberately excludes French place names that are common English words (Nice, Orange, Cannes, Lourdes).

**Infrastructure — 3 new ATS adapters** (`scripts/lib/ats-providers.mjs`), because all three target boards are JS apps and the HTML path found **zero** job links in them:
- `workable` — `apply.workable.com/api/v1/widget/accounts/{tenant}?details=true`. Location rules: on-site = "City, Region, Country"; a country-scoped remote seat keeps its country (else a France-only remote role reads as "Remote" and slips the filter); an open remote seat = "Remote".
- `digitalrecruiters` — POST `api.digitalrecruiters.com/public/v1/careers-site/job-ads` (GET is 405, `offset` is ignored, `page` works, locale must be `en_GB` not `en`). No dates in the payload → postings are undated; location is a bare city.
- `welcomekit` — server-rendered cards; the generic extractor threw the office city away, so French roles looked location-less and passed the filter.

All three covered by `scripts/test-ats-providers.mjs` (detection + fixture + malformed-payload cases). `scripts/test-portals-wiring.mjs` still green.

**Live check on the wired boards** (`node scripts/scan.mjs --company <name>`):
Exotec 83 roles seen / 0 matching · EasyMile 11 / 0 · Exail 127 / 0 (its one German role is customer support) · SBG Systems 11 / 0 (today's German role is sales) · Genesis AI 72 / 0 (London roles dropped by the location filter) · SCALLOG 0 (WTTJ bot-protected). **Zero France leakage** — French roles are dropped by the location filter, and the France-only boards are documented but not wired.

**Pipeline:** `verify-pipeline` 48 errors, all of them pre-existing `reports/<file>` not found (the reports dir is gitignored). `normalize-statuses` / `dedup-tracker` / `merge-tracker` → no changes, exit 0. `data/` untouched.

**No role added to `data/pipeline.md`** — nothing in this list is an actionable posting today.

