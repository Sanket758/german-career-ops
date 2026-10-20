# LinkedIn Job Scanner & Pre-Application Scoring — Technical Specification

**Status:** Draft v2 — requirements resolved, ready for Phase 0a
**Date:** 2026-10-20
**Revision:** v2 (1–10 CV match, A2 German gate, junior YoE gate, read-only handoff)
**Owner:** Sanket Gadge
**Target repo:** `/home/sanket758/Projects/german-career-ops`
**Target integration dir:** `integrations/linkedin-scan/`
**Runtime:** Node.js 18+ (ESM), Playwright 1.58, Python 3 (existing evaluator), Pop!_OS 22.04/24.04

---

## 0. Executive summary

Add a **read-only** LinkedIn discovery + scoring stage to career-ops:

```
logged-in Chrome (CDP :9222)
   │  Playwright attach (no profile lock, no cookie juggling)
   ▼
Scanner  ── discover → extract card + JD → normalize → dedup
   │
   ├─ hard gates: German > A2 · ≥7 YoE · wrong role/domain/location
   │                    └─► HARD_SKIP (recorded, never surfaced)
   ├─ deterministic prefilter (0–100)
   │
   └─ CANDIDATE (REVIEW with --deep-review) ──► career_ops_cli.py evaluate --match-10
                               └─ master CV ↔ JD → MATCH: 8.6/10
                                  └─► reports/{###}-{company}-{date}.md (+ tracker TSV)
   ▼
data/linkedin-scan/review-YYYY-MM-DD.md   ← ranked 1–10 match queue; you tailor + apply
```

Four properties drive every decision below:

1. **Selector resilience is the product.** The new LinkedIn search UI
   (`/jobs/search-results/`) renders obfuscated atomic classes (`div.i0lax0.i0lif5…`,
   `span.i0lmhr.i0laxk…`). A scanner built on those classes has a shelf life of days.
   The spec therefore defines a **tiered selector registry with drift telemetry and
   fail-closed behavior**, not a selector list.
2. **Auth is solved by process isolation, not by stealing cookies.** A dedicated
   Chrome profile behind CDP is already proven in this repo. Default-profile cookie
   extraction stays as a one-time bootstrap only.
3. **The headline score is a 1–10 CV↔JD match, not a keyword count.** The existing LLM
   evaluator reads the **master CV** and the extracted JD and returns `MATCH: X.X/10`.
   Stage 1 is only a cheap prefilter. The repo's 1–5 tracker scale is derived
   (`score_5 = match_10 / 2`) so the existing tracker, dashboard, and `verify-pipeline`
   contracts stay intact.
4. **The user applies.** The scanner never clicks Apply, never fills a form, and never
   writes to `data/applications.md` directly. Its handoff is the ranked queue plus a
   tailoring report: full JD, match evidence, gaps, and ATS keywords.

The two candidate constraints that dominate the German market are enforced twice — in the
deterministic gate and in the evaluator prompt:

- **German A2** (user-confirmed). Any explicit B1/B2/C1/C2, fluent/native, or
  "Deutsch erforderlich" requirement is a hard skip. A German-language JD alone is **not**
  a language requirement.
- **Junior (<5 years)**. A 5–6 year requirement costs −25 points; 7+ years is a hard skip.
  Junior/mid titles still receive the +8 boost.

---

## 1. Repository discovery — what exists today

Findings that constrain the design. Each line was verified in the repo, not assumed.

### 1.1 Ingestion

| Component | Path | Behavior |
|---|---|---|
| Zero-LLM portal scan | `scripts/scan.mjs` | Hits Greenhouse/Ashby/Lever APIs, applies `portals.yml` `title_filter` + `location_filter`, appends to `data/pipeline.md` and `data/scan-history.tsv` |
| Portal scan mode | `modes/scan.md` | 3-level strategy (Playwright → ATS APIs → WebSearch), dedup against history/tracker/pipeline, statuses `added`/`skipped_title`/`skipped_dup`/`skipped_expired` |
| Batch evaluator | `batch/batch-runner.sh`, `batch/batch-prompt.md` | Parallel `claude -p` workers over `batch-input.tsv` |
| Background LinkedIn scan | `scripts/job_background_scanner.py` | Cookie-based Playwright, heuristic 1–5 score, appends to CSV + pipeline |
| Legacy LinkedIn HTML parser | `scripts/linkedin_scan.py` | Parses **saved example HTML** with old BEM selectors (`artdeco-entity-lockup__subtitle`); not usable against today's UI |
| Apply bot (not a scanner) | `scripts/linkedin_batch_apply.mjs` | CDP attach → search → fit gate → Easy Apply → tracker TSV |

### 1.2 Canonical state

| Artifact | Path | Contract |
|---|---|---|
| Tracker | `data/applications.md` | 9-column pipe table `# \| Date \| Company \| Role \| Score \| Status \| PDF \| Report \| Notes` |
| Canonical statuses | `templates/states.yml` | `Evaluated, Applied, Responded, Interview, Offer, Rejected, Discarded, SKIP` |
| Additions | `batch/tracker-additions/*.tsv` | 9 columns, merged by `scripts/merge-tracker.mjs` |
| Seen-URL ledger | `data/scan-history.tsv` | `url \t first_seen \t portal \t title \t company \t status` |
| Pipeline inbox | `data/pipeline.md` | `- [ ] {url} \| {company} \| {title}`; `modes/scan.md` documents `local:jds/...`, but `cmd_pipeline()` only matches `https?://` rows (see §10.1) |
| JD archive | `jds/`, `data/job-descriptions/` | Markdown, YAML frontmatter (`title, company, location, url, jobId, date`) |
| Integrity chain | `verify-pipeline.mjs` → `normalize-statuses.mjs` → `dedup-tracker.mjs` → `merge-tracker.mjs` | Never edit `applications.md` directly |

### 1.3 Scoring — two layers already exist

**Layer A — deterministic keyword fit** (`scoreRole()` in `linkedin_batch_apply.mjs`):
`CORE_KW` × 2 + `SECONDARY_KW` × 1, hard-skip list, verdict
`APPLY | MARGINAL | MISMATCH | HARD_SKIP`. Fast, but only used inside the apply bot and
duplicated in `job_background_scanner.py` / `linkedin_scan.py` with different weights.

**Layer B — LLM evaluation, two implementations of the same 1–5 banding.**

- **Agent mode** (`modes/oferta.md` + `modes/_shared.md`): 6 blocks A–F + legitimacy G,
  score 1–5, banding `≥4.5 apply now / 4.0–4.4 apply / 3.5–3.9 consider / <3.5 skip`.
  This is what Claude/Codex runs interactively. It is **not** reachable from a shell
  command and does **not** read `career_ops_cli.py`.
- **Programmatic evaluator** (`scripts/career_ops_cli.py evaluate <url>`):
  `fetch_jd()` → Ollama → `reports/{###}-{slug}-{date}.md` + tracker TSV.
  `build_eval_system_prompt()` is a **self-contained condensed prompt with 7 sections**
  (Summary, Score, Match, Gaps, Blockers, Recommendation, Keywords) and the same 1–5
  bands. It never loads `modes/oferta.md`, so its output is *not* an A–G report.
  `extract_recommendation()` returns `APPLY | CONSIDER | SKIP`.

Two consequences the spec must respect:

1. `--deep` produces **CLI reports**, not A–G reports. Aligning the CLI prompt with the
   A–G contract is explicitly out of scope (§2 N5); the match score is a new 1–10 output,
   the section structure is not.
2. `OLLAMA_MODEL` defaults to `gemma4:e2b-it-q4_K_M`, which is **not installed** on this
   machine (`ollama list` shows `gemma4:e2b`). Every deep call fails at model load until
   the default or the env var is fixed — Phase 3 pre-requisite (§9.2).
3. The CLI's existing `SCORE: X.X/5` contract is **additive, not replaced**. The scanner
   calls `evaluate --match-10`, which asks the same model for `MATCH: X.X/10` against the
   master CV and emits both values in JSON. Default `evaluate <url>` behavior is unchanged.

**The gap this spec closes:** `fetch_jd()` cannot read LinkedIn (login wall). Evidence:
`data/pipeline.md` is full of `UNRESOLVED — could not read via ATS API` rows. So the
scanner must hand the evaluator **text**, not a URL. `evaluate` needs a `--jd-file` path
(§9.2).

### 1.4 Auth assets already in the repo

| Asset | Path | State |
|---|---|---|
| CDP launcher (idempotent) | `scripts/launch-career-ops-chrome.sh` | Works; profile `~/.config/career-ops-chrome`, port 9222 |
| Attach + verify + save state | `scripts/linkedin_attach.mjs` | **Bootstrap only.** Unconditionally injects `data/linkedin_cookies.json` (overwrites a fresh `li_at`), uses a loose auth heuristic, and calls `browser.close()` on the CDP session. Do not run it in steady state; §4.6 replaces it. |
| Cookie extractor | `scripts/extract_linkedin_cookies.py` | Works for **Chrome only**; v10/v11 AES-CBC decryption, keyring label `Chrome Safe Storage` |
| Cookies / state | `data/linkedin_cookies.json`, `data/linkedin_storage_state.json` | Present — 34 cookie entries / 29 unique names incl. `li_at`, `JSESSIONID`, `bscookie` — treat as stale snapshots, never as the source of truth |

Prior art (vault, verified 2026-08-14): Chrome ≥136 refuses to bind
`--remote-debugging-port` on the **default** data dir. `--user-data-dir` is mandatory.
Do not re-debug this.

### 1.5 UI evidence from `integrations/linkedin-scan/*.png`

Observed on 2026-10-18, `linkedin.com/jobs/search-results/?currentJobId=4454388223…`:

| Screenshot | Element | Observed in DevTools | Stability |
|---|---|---|---|
| `…15-58-22.png` | job card (Alexa Pflege) | `div.i0lax0.i0lif5.i0ljmv.i0lji8.i0ljmm.i0ljjp.i0lmlu`, 420×130, `role=generic` | **volatile** |
| `…15-58-06.png` | results list container | `div.i0lmlt.i0l82.i0lax0.i0lif5…`, 450×767, bg `#16191C` | **volatile** |
| `…15-57-42.png` | job description body | `span.i0lmhr.i0laxk.i0jnf.i0lmlu`, 612×1743 | **volatile** |
| `…15-57-56.png` | detail header | `div.i0llna…`, 660×64, padding `8px 24px` | **volatile** |
| `…15-58-20.png` | job card | 420×110 | **volatile** |

Stable signals visible in the same screenshots:

- Cards are links with an href containing `/jobs/view/<numeric id>`.
- Selected job is encoded in `?currentJobId=<id>`.
- Text anchors: `About the job`, `Applied now`, `Be an early applicant`,
  `Easy Apply` / `LinkedIn Apply`, `Promoted`, `99+ results`, `Berlin (80 km)`.
- Relative time: `3 hours ago`, `29 minutes ago`, `10 minutes ago`, `17 hours ago`.
- Work mode is a parenthetical on the location line: `(On-site)`, `(Hybrid)`, `(Remote)`.
- Filter bar items are `div[role=radio][aria-checked]` (vault-verified, 13 filters, no "All Filters" modal).
- Pagination indicator `1/4`; URL param `start=25` steps through pages.

**Conclusion:** the only durable extraction substrate is
*link href + visible text + geometry + ARIA*, never class names. §6 formalizes this.

---

## 2. Goals, non-goals, anti-goals

### Goals

- **G1** Discover LinkedIn jobs from one or more saved searches in a single run,
  with pagination and de-duplication.
- **G2** Extract a complete, structured `JobRecord` per job: title, company, location,
  work mode, posted age, badges, apply type, full JD text + markdown, job id, canonical URL.
- **G3** Survive LinkedIn DOM redesigns: no extraction path may depend on an atomic class
  as its only strategy, and drift must be *detected and reported*, not silently absorbed.
- **G4** Reuse the repo's existing filters (`portals.yml`) and existing LLM scorer
  (`career_ops_cli.py evaluate`) rather than inventing a parallel scoring system. Add a
  `--match-10` mode that scores the **extracted JD against the master CV** on a 1–10 scale.
- **G5** Produce a ranked human decision queue sorted by the 1–10 CV match, with
  machine-readable reasons, the full JD file, and a link to the report for tailoring.
- **G6** Keep the tracker integrity chain intact: one merge path, canonical statuses,
  `npm run verify` stays green. The tracker's 1–5 Score column receives
  `score_5 = match_10 / 2`.
- **G7** Be polite and bounded: configurable delays, per-run caps, hard stop on
  authwall/429/999, no concurrency.
- **G8** Enforce the candidate's real constraints: **German A2** (B1+ is a hard skip) and
  **junior roles (<5 years)** (5–6 years penalized, 7+ hard skip). Target roles are
  Python/AI developer, ML/AI engineer, and computer vision.
- **G9** Make manual application easy: every deep-scored job has a report containing the
  JD, top CV evidence, gaps, blockers, and ATS keywords. No auto-apply.

### Non-goals

- N1 Applying, form filling, messaging, or connecting.
- N2 Scraping people, profiles, or recruiter contact data.
- N3 Bypassing CAPTCHAs, checkpoints, or rate limits. A challenge is a stop condition.
- N4 Multi-account rotation or proxy pools.
- N5 Replacing `modes/oferta.md`, re-implementing A–G blocks, or rewriting the CLI's
  condensed prompt into A–G form. The two evaluators keep their current default contracts;
  `--match-10` is an additive scanner-only mode.
- N6 Mobile app / internal GraphQL reverse engineering as a *primary* path.
  (Voyager JSON capture is an optional Phase 4 enhancement, §6.8.)
- N7 Scheduling (cron/systemd) — out of scope, but the CLI is cron-safe by design.

### Anti-goals (definitions of failure even if the code "works")

- AG1 A run returns 0 jobs and reports success because a selector silently matched nothing.
- AG2 A job is written with an empty/`Unknown` company or title.
- AG3 A JD of <200 chars is scored as if complete.
- AG4 A duplicate creates a second tracker row.
- AG5 The scanner ever opens the user's default Chrome/Brave profile directory.
- AG6 The scanner falls into an apply flow.
- AG7 Score noise: the pre-score gate sends 80% of jobs to the expensive LLM stage.
- AG8 A B1+ German requirement, or a 7+ year requirement, reaches the LLM stage.
- AG9 A German-language JD is skipped solely because it is written in German.
- AG10 A 1–10 match is synthesized from the 0–100 prefilter and presented as a CV match.

---

## 3. Architecture

### 3.1 Components

```
integrations/linkedin-scan/
├── SPEC.md                       ← this document
├── README.md                     ← operator quickstart (Phase 4 deliverable; stub in Phase 1)
├── cli.mjs                       ← command dispatcher (scan | score | report | auth | selectors | doctor)
├── config.example.yml            ← system defaults (user override: config/linkedin-scan.yml)
├── lib/
│   ├── browser.mjs               ← CDP connect, page/context selection, auth verify, stop signals
│   ├── search-url.mjs            ← build/parse LinkedIn search URLs, page stepping
│   ├── extract-cards.mjs         ← card discovery (scroll, paginate, virtualized list)
│   ├── extract-detail.mjs        ← JD pane extraction + fallbacks + expansion
│   ├── selectors.mjs             ← tiered resolver registry + health matrix  [Phase 0a]
│   ├── parse.mjs                 ← text → title/company/location/work-mode/posted/badges  [Phase 0a]
│   ├── inject.mjs                ← module source → in-page script            [Phase 0a]
│   ├── atomic.mjs                ← obfuscated-class pattern + renamer       [Phase 0a]
│   ├── normalize.mjs             ← canonical URL, ids, company/title normalization, hashes
│   ├── dedup.mjs                 ← history / tracker / pipeline / burned / jd-hash
│   ├── prescore.mjs              ← deterministic Stage 1 (0–100)
│   ├── deepscore.mjs             ← bridge to career_ops_cli.py evaluate --match-10 --jd-file
│   ├── store.mjs                 ← atomic JSONL/JSON writes, state, scan-history append
│   ├── report.mjs                ← review-YYYY-MM-DD.md + latest.json
│   └── log.mjs                   ← structured run log
├── fixtures/
│   ├── search-results.html       ← captured DOM (new UI)                   [Phase 0a]
│   ├── search-results.atomic-renamed.html  ← same DOM, all i0*/js0* classes renamed
│   └── README.md                 ← capture date, URL, UI variant, how to refresh
├── tools/
│   ├── capture-fixture.mjs       ← capture + sanitize the fixture pair      [Phase 0a]
│   ├── update-golden.mjs         ← regenerate the golden records            [Phase 0a]
│   ├── wait-auth.mjs             ← wait for a human login, save the state   [Phase 0a]
│   └── open-login.mjs            ← open the login page in the automation Chrome
└── test/
    ├── selectors.test.mjs        ← fixture tests in a real Chromium        [Phase 0a]
    ├── parse.test.mjs            ← text rules, no browser                  [Phase 0a]
    ├── golden/cards.json         ← the 25 expected card records            [Phase 0a]
    ├── normalize.test.mjs
    ├── dedup.test.mjs
    ├── prescore.test.mjs
    ├── deepscore.test.mjs
    ├── search-url.test.mjs
    └── cli-dryrun.test.mjs
```

Shared code extracted from the apply bot into `scripts/lib/` (Phase 1, §11.2):

```
scripts/lib/
├── skill-lexicon.mjs   ← CORE / SECONDARY / blockers, years map; single source of truth
├── tracker-keys.mjs    ← normalizeCompany / normalizeRole / roleMatch / parseScore
└── linkedin-url.mjs    ← job-id extraction, canonicalization, search-url builder
```

### 3.2 Data flow

```
 config.example.yml ← config/linkedin-scan.yml + portals.yml filters
        │
        ▼
 [1] auth.verify ──fail──► exit 2
        │
        ▼
 [2] for each query: open search URL → page 0..N
        │        ├─ scroll list until stable (virtualized)
        │        └─ extract cards (id, title, company, location, posted, badges)
        ▼
 [3] dedup (scan-history, tracker, pipeline, records, badge=Applied)
        │
        ▼
 [4] for each new job: click card → wait for detail → extract JD → save jds/linkedin/*.md
        │
        ▼
 [5] normalize + JobRecord
        │
        ▼
 [6] hard gates + Stage 1 prefilter (0–100)
        ├─ German B1+ / ≥7 YoE / wrong role → HARD_SKIP
        └─ HARD_SKIP | SKIP | REVIEW | CANDIDATE
        │
        ├──► append data/scan-history.tsv (portal=linkedin, status)
        ├──► append data/linkedin-scan/records/YYYY-MM-DD.jsonl
        │
        ▼
 [7] --deep: for CANDIDATE (and REVIEW with --deep-review)
        └─► python3 scripts/career_ops_cli.py evaluate --match-10 --jd-file … --json
              └─► master CV ↔ JD → match_10 (1–10)
                    └─► reports/*.md + batch/tracker-additions/*.tsv
        │
        ▼
 [8] report: data/linkedin-scan/review-YYYY-MM-DD.md + latest.json, sorted by match_10
```

### 3.3 Isolation rules

- One browser context, one page, sequential jobs. No parallelism anywhere.
- The scanner never launches Chrome itself in steady state — it attaches to the
  already-running automation profile. `--launch` is an explicit opt-in that calls
  `scripts/launch-career-ops-chrome.sh`.
- The scanner never writes `data/applications.md`.
- The scanner never posts, applies, messages, or reacts.

---

## 4. Authentication strategy (Pop!_OS / Linux)

### 4.1 Requirement

A persistent LinkedIn session that survives machine reboots, never fights the user's
daily browsers for a profile lock, and recovers without re-engineering.

### 4.2 Options considered

| # | Option | Works on Linux? | Verdict |
|---|---|---|---|
| A | Point Playwright at `~/.config/google-chrome` | **No** — Chrome holds `SingletonLock`/`SingletonCookie`/`SingletonSocket`; launching a second process on the same data dir fails or corrupts state; Chrome also refuses `--remote-debugging-port` on the default dir | **Rejected** |
| B | Same for `~/.config/BraveSoftware/Brave-Browser` | **No** — same lock semantics, plus Brave's default profile is the user's daily driver | **Rejected** |
| C | Clone the whole Chrome/Brave profile directory into `~/.config/career-ops-chrome` | Fragile — 1–3 GB, extension state, GPU cache, `Local State` encryption keys tied to keyring; copies go stale immediately | **Rejected** |
| D | Extract + decrypt cookies from the live browser, inject into `browser.newContext({ storageState })` | Works for **bootstrap**, but `li_at` rotates, `__cf_bm`/`li_rm` are device-bound, and a challenge can invalidate the parent session; requires keyring access (`v11`) | **Bootstrap only** |
| E | **Dedicated persistent Chrome profile + CDP attach on :9222** | **Yes** — already proven in this repo (`launch-career-ops-chrome.sh`, `linkedin_attach.mjs`); one-time login; survives restarts; default profiles untouched | **CHOSEN** |
| F | Headless `launchPersistentContext` on the dedicated profile (no CDP) | Works only when no other process holds the dir; LinkedIn treats headless more suspiciously | **Fallback** |

### 4.3 Decision

**Primary (steady state): Option E.** Attach over CDP to a dedicated profile.

```bash
bash scripts/launch-career-ops-chrome.sh          # idempotent; starts :9222 if absent
node integrations/linkedin-scan/cli.mjs auth --verify
```

Profile: `${CAREER_OPS_CHROME_PROFILE:-$HOME/.config/career-ops-chrome}`
Port: `${CAREER_OPS_CHROME_PORT:-9222}` (bound to `127.0.0.1` only).

`lib/browser.mjs`:

```js
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const ctx = browser.contexts()[0];              // the real, logged-in context
const page = ctx.pages().find(isLinkedInTab) ?? await ctx.newPage();
```

Properties this buys us:

- No profile lock: Chrome is the owner, Playwright is a passenger.
- Cookies are the profile's own — nothing to decrypt, nothing to rotate.
- `storageState` can be exported at any time for headless fallback.
- The user can inspect the same window without killing the run (read-only).

### 4.4 One-time login / re-auth procedure

1. `bash scripts/launch-career-ops-chrome.sh`
2. In that window, open `linkedin.com` and log in **once** (password or Google SSO).
   This establishes device trust inside the automation profile.
3. `node integrations/linkedin-scan/cli.mjs auth --verify` → must print
   `AUTHED: true (profile=career-ops-chrome, li_at=present, url=/feed/)`.
   **This is the steady-state check.** Do not run `scripts/linkedin_attach.mjs` here: it
   re-injects the stale `data/linkedin_cookies.json` and can overwrite the fresh `li_at`
   that step 2 just created.
4. Optional hardening: `node integrations/linkedin-scan/cli.mjs auth --export-state` →
   writes `data/linkedin_storage_state.json` for headless fallback **without injecting
   cookies** (read-only `ctx.storageState()`). This is the supported replacement for
   `linkedin_attach.mjs`.

### 4.5 Bootstrap from the user's existing Chrome/Brave session

Only needed the first time, or if the automation profile is lost. Never the steady state.
Importing a session can invalidate the same session in the source browser (LinkedIn rotates
tokens on a new device), so prefer a real login in the automation profile (§4.4) whenever
that is possible.

```
node integrations/linkedin-scan/cli.mjs auth --import-cookies --browser brave
```

Required changes to `scripts/extract_linkedin_cookies.py`:

| Change | Detail |
|---|---|
| `--browser {chrome,brave,chromium}` | Path map: Chrome `~/.config/google-chrome/Default/{Cookies,Network/Cookies}`; Brave `~/.config/BraveSoftware/Brave-Browser/Default/{Cookies,Network/Cookies}` |
| Keyring label map | Chrome → `Chrome Safe Storage`; Brave → `Brave Safe Storage`; Chromium → `Chromium Safe Storage` |
| Copy `Cookies`, `Cookies-wal`, `Cookies-shm` together | Otherwise the newest `li_at` can live only in the WAL |
| `--output` | Default stays `data/linkedin_cookies.json` |
| Fail closed | If `li_at` missing → non-zero exit, no partial file written |

Injection: `ctx.addCookies(...)` against the **automation** context, then reload `/feed/`.
After a successful import, the spec recommends a real login in the automation profile so
the session gets its own device fingerprint; imported cookies are treated as fragile.

### 4.6 Auth verification (replaces the current heuristic)

The current check in `linkedin_attach.mjs` (`/Sanket|Me|Home|Jobs/i`) can pass on an
authwall because the word "Jobs" is in the nav. New rule, all must hold:

1. Final URL host is `www.linkedin.com` and path is `/feed/` or `/jobs/…`.
2. Final URL does **not** match `/login|authwall|uas/|checkpoint|challenge`.
3. `document.querySelector('img.global-nav__me-photo, header a[href^="/in/"], nav a[href^="/in/"]')` exists (scoped to header/nav so a footer link cannot satisfy it).
4. Cookie `li_at` present in `ctx.cookies()`.

Any failure → `AUTH_FAILED`, exit code 2, with the exact failing rule printed.

### 4.7 Session failure taxonomy

| Signal | Meaning | Action |
|---|---|---|
| `authwall`, `/login`, `/uas/login`, `checkpoint/challenge` | Session dead or challenged | Stop run immediately. Exit 2. Print re-auth steps. |
| HTTP 999 / 429 | LinkedIn throttling/blocking | Stop run. Write `RATE_LIMITED` to state. Backoff before next run (≥30 min). |
| HTTP 5xx repeated 3× | LinkedIn incident | Stop. Exit 3. |
| `li_at` present but `/feed/` redirects | Partial session | Treat as auth failure; do not retry more than once. |
| Stale `SingletonLock` after crash | Chrome won't start | `readlink ~/.config/career-ops-chrome/SingletonLock`; if pid dead, remove lock + socket, relaunch. |

### 4.8 Launch flags (patch to `launch-career-ops-chrome.sh`)

Add, so a background tab keeps rendering during long runs:

```
--disable-background-timer-throttling
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
--disable-features=CalculateNativeWinOcclusion
```

Do **not** add `--headless`, `--no-sandbox`, or UA spoofing. Those increase challenge risk.

---

## 5. Search configuration

### 5.1 URL contract

Canonical entry point (matches the screenshots):

```
https://www.linkedin.com/jobs/search-results/
  ?keywords=<urlencoded>
  &location=<city|Germany>
  &geoId=101282230
  &distance=80
  &f_AL=true
  &f_E=2%2C3%2C4
  &f_JT=F
  &f_TPR=r86400
  &start=<0|25|50|…>
```

| Param | Meaning | Notes |
|---|---|---|
| `keywords` | search terms | one query per keyword group, not one per word |
| `location` | free-text geo | `Germany`, `Berlin` |
| `geoId` | LinkedIn geo id | **`101282230` = Germany**; `91000000` = European Union (too broad — do not use for a Germany-wide search) |
| `distance` | radius km | screenshot shows `Berlin (80 km)` |
| `f_AL=true` | LinkedIn Apply filter | UI label changed to "LinkedIn Apply"; **param unchanged** (vault-verified) |
| `f_E=2,3,4` | LinkedIn codes: 2 entry, 3 associate, 4 mid-senior | target is junior–mid (<5 YoE). Code 4 is kept because many 3–5-year roles are filed there; the title and YoE gates remove true senior roles. Use `f_E=2,3` for a stricter junior-only run |
| `f_JT=F` | full-time | CODE RED |
| `f_TPR=r3600` | past **1 hour** | `--since 1h`; narrow pool for a quick "what is new since my last run" check |
| `f_TPR=r86400` | past **24 hours** | **default** (`--since 24h`); matches the screenshot |
| `f_TPR=r604800` | past 7 days | `--since 7d`; broader reach, more stale reposts |
| `start` | pagination | 25 per page; `1/4` in screenshot ⇒ 4 pages available |

**Freshness is recency, not a probability multiplier.** `r3600` narrows the candidate pool
to jobs posted in the last hour; it does not "exponentially" increase the odds of any one
job. It pays off only when the scan runs frequently (e.g. hourly during a launch week) and
the alert latency matters. The default stays 24 h so a once-daily run sees a full day.

**Easy Apply is a filter, not a requirement.** `f_AL=true` matches the screenshots and the
existing apply bot, but this integration is read-only: external-ATS jobs are perfectly
applicable manually. Set `search.linkedin_apply_only: false` to include them; the
`easy_apply` field still records which flow each job uses.

`geoId` is a **per-country** id, not a per-city id. `location=Berlin` still resolves
against Germany, so the global default is correct for all German queries. A query whose
`location` is outside Germany must declare its own `geo_id`; otherwise the run fails
config validation (exit 5) instead of silently searching inside Germany.

> Pre-existing bug, fixed separately: `scripts/linkedin_scan.py:81` still defaults to
> `geo_id="91000000"`. That is the legacy HTML parser and is not on this integration's
> path, so it is out of scope — but it should not be copied.

The apply bot still calls `/jobs/search/`; the scanner always emits
`/jobs/search-results/`. This spec does **not** assert that one redirects to the other
(unverified), and does not migrate the apply bot. `doctor` checks only the
`/jobs/search-results/` endpoint it actually uses.

### 5.2 Config — system defaults plus a user override

Two files, same schema:

| File | Layer | Purpose |
|---|---|---|
| `integrations/linkedin-scan/config.example.yml` | system (tracked) | Shipped defaults; updated with the code |
| `config/linkedin-scan.yml` | **user** (untracked, like `config/profile.yml`) | Optional overrides; never rewritten by updates |

Load order: defaults ← user file ← CLI flags. Unknown keys are a config error (exit 5) so
a typo cannot silently disable a limit. `config/linkedin-scan.yml` is created on first run
from the example if absent (commented, no active overrides).

```yaml
version: 1

search:
  base_url: https://www.linkedin.com/jobs/search-results/
  location: Germany
  geo_id: "101282230"            # Germany. 91000000 is the EU — never use it here.
  distance_km: 80
  experience_levels: [2, 3, 4]   # entry, associate, mid-senior (4 is kept for 3–5 YoE roles)
  job_type: F                     # full-time
  posted_within: r86400          # default 24h. Presets: r3600 (1h), r86400 (24h), r604800 (7d)
  linkedin_apply_only: true
  queries:
    - name: AI/ML Berlin 24h
      keywords: "AI ML Machine Learning"
      location: Berlin
    - name: Computer Vision Germany 24h
      keywords: "Computer Vision"
    - name: Python AI Developer Germany 24h
      keywords: "Python AI Developer"
    - name: ML Engineer Germany 24h
      keywords: "Machine Learning Engineer"
    - name: GenAI Engineer Germany 24h
      keywords: "Generative AI LLM"
    - name: Robotics Perception Germany 24h
      keywords: "Robotics Perception ROS2"
    # Optional per-query escape hatch; required when location is outside Germany.
    # - name: Zurich ML
    #   keywords: "Machine Learning"
    #   location: Zurich
    #   geo_id: "106693272"

limits:
  # Card collection and detail extraction are budgeted separately: a query can yield
  # 2 pages × 25 cards, but only the first N get an expensive detail visit.
  max_cards_per_query: 50
  max_pages_per_query: 2
  max_detail_per_query: 25
  max_jobs_per_run: 120
  max_scan_minutes: 35            # scan phase only
  deep_budget_minutes: 30         # LLM phase only; hard ceiling ~70 min with the scan phase
  min_delay_ms: 2500
  max_delay_ms: 6000
  page_delay_ms: [8000, 15000]     # between result pages
  detail_settle_ms: 3500
  max_detail_fallbacks_per_run: 10
  max_consecutive_extraction_failures: 5
  keep_applied_jd: false          # already-applied jobs are recorded from the card only

scoring:
  title_filter_source: portals.yml   # positive / negative / location only
  candidate_threshold: 55
  review_threshold: 35
  burn_list_penalty: 50
  # portals.yml seniority_boost deliberately includes Senior/Lead/Staff ("no penalty for
  # senior"). That list is a portal-scan boost and MUST NOT be reused as a penalty source.
  seniority_light: [junior, mid, entry, graduate, trainee]
  seniority_heavy: [senior, lead, staff, principal, head of, director, manager, architect, expert, specialist]
  seniority_penalty: -20
  allow_senior: false            # --allow-senior sets the penalty to 0 and lifts the REVIEW cap
  # Behavior-neutral base lexicon + scanner overlay; see §9.1.2.
  lexicon:
    extra_core: [ros2, slam, perception, neural network, segmentation]
    extra_secondary: [mlflow, weights & biases, onnx, tensorrt]
    remove_blockers: [in-office, berlin only, munich only, frankfurt only]
    demote_blockers: { devops engineer: -15 }
  # 1–10 CV↔JD match. Stage 1 is only a prefilter; this block drives the headline.
  match:
    scale: 10                       # report + queue headline
    tracker_scale: 5                # existing tracker Score column; score_5 = match_10 / 2
    cv_path: "~/Mission - Job/sanket/designer_cvs_v3/tests/extracted/master.txt"
    cv_max_chars: 3000
    candidate_german_level: A2      # any explicit B1+ is a hard skip
    german_nice_to_have_penalty: -6 # "Deutsch von Vorteil" / "nice to have"
    german_jd_language_penalty: 0   # a German-language JD alone is NOT a requirement
    yoe_candidate_years: 4          # from the master CV; used only for reason strings
    yoe_penalty_min: 5              # 5–6 years required → −25
    yoe_hard_skip_min: 7            # 7+ years required → HARD_SKIP
    yoe_penalty: -25
  deep_limit: 15
  deep_model: null               # null -> OLLAMA_MODEL (see §9.2)

selectors:
  profile: auto            # auto | strict
  allow_atomic_classes: false
  drift_warn_ratio: 0.20   # >20% legacy-tier resolutions ⇒ warn
  fixtures: integrations/linkedin-scan/fixtures

storage:
  root: data/linkedin-scan
  jd_dir: jds/linkedin
  history: data/scan-history.tsv
  tracker: data/applications.md
  pipeline: data/pipeline.md
  burn_list: data/burn-list.tsv   # optional
```

Every path in this file is **repo-root-relative**, with one deliberate exception:
`scoring.match.cv_path` is user-owned external data, so it is resolved with `~` expansion
and may be absolute. The loader resolves the other paths from the repo root (not from the
config file's directory), so the identical schema works from `config/linkedin-scan.yml` and
from `integrations/linkedin-scan/config.example.yml`. Absolute paths are accepted only via
CLI flags, env vars, or `cv_path`.

There is **no** query import from `portals.yml`. Its 15 `LinkedIn — …` entries are Google
dorks (`site:linkedin.com/jobs …`) used by the zero-LLM portal scan, not LinkedIn search
keywords; feeding them to `keywords=` would search for the literal string `site:linkedin.com`.
The scan surface stays explicit in `search.queries`.

`integrations/` is not in `update-system.mjs` `SYSTEM_PATHS`, so this integration is never
auto-updated today. That is intentional for v1 (the files are user-tuned); promoting it to
the system layer is a separate decision.

---

## 6. DOM extraction and selector resilience (core section)

### 6.1 The rule

> No extraction path may depend on an atomic class (`i0…`) as its only strategy.
> Every field has a ranked resolver chain. A required field that exhausts its chain
> **fails the record**; it never degrades to `Unknown`.

### 6.2 Selector tiers

| Tier | Substrate | Example | Stability | Role |
|---|---|---|---|---|
| **T0** | Link semantics / URL | `a[href*="/jobs/view/"]`, `?currentJobId=` | Highest | Job identity in the detail pane |
| **T0** | Stable non-class attribute | `componentkey="job-card-component-ref-<id>"` | Highest | **Card identity — the only job id inside a card** (verified 2026-10-20) |
| **T0** | Visible text anchors | `About the job`, `Applied now`, `Be an early applicant`, `Promoted` | High | Section location, states |
| **T0** | ARIA | `div[role=radio][aria-checked]`, `[role=dialog]`, `aria-label="Company, <name>."` | High | Filters, modals, company name |
| **T1** | Legacy BEM classes | `.jobs-description__content`, `.job-card-list__title`, `.jobs-apply-button` | Medium (still present in older surfaces) | Fast path |
| **T2** | Attribute substring | `[class*="jobs-description"]`, `[data-test-*]` | Medium-low | Transitional |
| **T3** | Geometry / structure | "deepest element with >400 chars", "ancestor with exactly one job link" | High (layout-driven) | Generic fallback |
| **T4** | Atomic classes | `div.i0lax0…` | **Hours–days** | Debug/tie-break only, disabled by default |
| **T5** | Network JSON (Voyager) | `/voyager/api/jobs/jobPostings/<id>` | Medium (schema changes) | Optional Phase 4 enrichment |

`selectors.mjs` exports:

```js
export const RESOLVERS = {
  cardRoot:      { required: true,  tier: 'T0', chain: ['componentKey', 'anchorGeometry', 'commonParent'] },
  cardTitle:     { required: true,  tier: 'T3', chain: ['textLines', 'ariaLabel'] },
  cardCompany:   { required: true,  tier: 'T3', chain: ['companySpan', 'detailHeader', 'fail'] },
  cardLocation:  { required: false, tier: 'T3', chain: ['locationLine'] },
  cardPosted:    { required: false, tier: 'T3', chain: ['metaRelativeTime'] },
  detailJD:      { required: true,  tier: 'T1', chain: ['expandableTextBox', 'textAnchor', 'largestTextBlock'] },
  detailTitle:   { required: false, tier: 'T0', chain: ['jobViewLink', 'heading'] },
  detailCompany: { required: false, tier: 'T0', chain: ['ariaCompanyLabel', 'companyLink'] },
  appliedState:  { required: false, tier: 'T0', chain: ['appliedBadgeText', 'applyButtonAbsent'] },
};
```

Each resolver returns `{ value, tier, resolver, confidence }` or `null`.
`scan` records `extraction.tiers` per job; `selectors --test` prints the matrix.

### 6.2.1 What the live DOM actually looks like (verified 2026-10-20)

Phase 0a captured the real search-results page (25 cards). Five findings changed this
spec; they are the reason the implementation is built the way it is.

1. **A job card contains no links at all.** The card is a
   `div[role="button"][tabindex="0"]` and its title, company and location are plain
   text. The only `a[href*="/jobs/view/"]` on the page belongs to the *detail pane*.
   The earlier assumption that card discovery hangs off job links is wrong.
2. **The job id lives in `componentkey`.** Every card carries
   `componentkey="job-card-component-ref-<job id>"` — a stable, non-class attribute.
   It is the most reliable identity hook available and it is Tier 0.
3. **The obfuscated classes changed.** The screenshots show `i0…`; today's page uses
   `js0…` (`js0lk1 js0ax9 js0ify …`). Both match
   `/^(?:[a-z]{1,3})0[a-z0-9]{2,}$/`, which is the pattern the mutation test renames.
4. **The title is rendered twice.** Once for assistive technology (with a
   `(Verified job)` marker) and once for sighted users. The two copies sit in adjacent
   inline spans, so with the stylesheet loaded they land on two lines and without it on
   one line (`"AI/ML EngineerAI/ML Engineer"`). The parser must handle both.
5. **LinkedIn ships invalid nesting.** The description is
   `<p><span data-testid="expandable-text-box"><p>…</p></span></p>`; the browser repairs
   it by closing the outer `<p>`, which leaves the text box **empty** and the
   description paragraphs as its siblings. Reading the text box yields nothing — the
   section around the "About the job" heading is the source of truth.

Because the layout is not stable enough to trust `innerText` (it depends on the
stylesheet), text extraction uses a **structure-based line walker** (`textLines()`):
lines break at block-level elements, which is a property of the markup and survives a
redesign that shuffles the classes.

### 6.3 Card discovery (virtualized list safe)

```js
// lib/selectors.mjs — runs in the page
export function findCards(root) {
  const byId = new Map();
  for (const el of root.querySelectorAll('[componentkey^="job-card-component-ref-"]')) {
    const id = (el.getAttribute('componentkey').match(/(\d{6,})/) || [])[1];
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) { byId.set(id, { job_id: id, el, tier: 'T0', resolver: 'componentKey' }); continue; }
    if (existing.el.contains(el)) continue;      // keep the outer (clickable) element
    if (el.contains(existing.el)) byId.set(id, { job_id: id, el, tier: 'T0', resolver: 'componentKey' });
  }
  return [...byId.values()];
}
```

**Fallbacks, in order** (used when the `componentkey` attribute is gone):
`a[href*="/jobs/view/"]` → `climbToCard(a)` → legacy `li` containing a job link →
`[role="listitem"]` → nearest common ancestor of ≥3 job links that is itself
scrollable.

**`climbToCard(a)` — the geometric card root.** This is the replacement for atomic classes:

```js
function climbToCard(a) {
  let el = a;
  for (let depth = 0; depth < 8 && el; depth++, el = el.parentElement) {
    const r = el.getBoundingClientRect();
    const jobLinks = el.querySelectorAll('a[href*="/jobs/view/"]').length;
    const textLen = (el.innerText || '').trim().length;
    if (jobLinks === 1 && textLen >= 20 && textLen <= 1200 &&
        r.width >= 200 && r.height >= 55 && r.height <= 340) {
      return el;
    }
  }
  return null;
}
```

Bounds come from the screenshots (cards measured 420×110 and 420×130). Widen the
height range in Phase 1 after measuring live: `55–340px` covers one-line and
three-line cards plus the "1 connection works here" variant.

**Scroll target** must not assume `.jobs-search-results-list` (that class is from the
older surface). Resolve it:

```js
function findScrollPane() {
  const anchor = document.querySelector('a[href*="/jobs/view/"]');
  for (let el = anchor?.parentElement; el; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 40) return el;
  }
  return document.scrollingElement;
}
```

**Click target:** the card element itself (`div[role="button"]` carrying the
`componentkey`), never the card centre — each card has an `…` menu and an `✕` dismiss
in the top-right (visible in every screenshot). Clicking the card body risks
dismissing the job.

### 6.4 Card field parsing (text-only, no classes)

The card's text is read with `textLines()` (§6.2.1) — lines break at block-level
elements, not at stylesheet-driven line boxes. Everything below happens on those
lines, so no CSS class is involved.

```js
const LOCATION_RE = /(Berlin|München|Munich|Hamburg|Frankfurt|Stuttgart|Köln|Cologne|Düsseldorf|Leipzig|Dresden|Nürnberg|Karlsruhe|Deutschland|Germany|Remote|Homeoffice|Hybrid|On-site|Vor Ort|Präsenz)/i;
const AGE_RE = /(\d+)\s*(minute|hour|day|week|month)s?\s+ago|gerade eben|just now|vor\s+(\d+)\s*(minute|stunde|tag|woche|monat)/i;
const BADGES = [/be an early applicant/i, /promoted/i, /linkedin apply|easy apply/i,
  /^(applied|applied now|beworben)$/i, /reposted/i, /verification/i,
  /actively reviewing applicants/i, /^\d+ connection/i];
const LEGAL_FORM = /^(gmbh|gmbh & co\.? kg|ag|se|ug|mbh|inc\.?|ltd\.?|sarl|bv|nv)$/i;
```

| Field | Algorithm |
|---|---|
| `title` | first content line; **de-duplicate the double rendering** (§6.2.1 item 4): `"Role (Verified job)Role"` → `Role`, `"RoleRole"` → `Role`; strip the `(Verified job)` marker; keep `(m/w/d)` in the display title and strip it in `title_norm` |
| `company` | **Multi-line safe, never `Unknown`:** (1) `locIdx` = first content line that looks like a location (a work-mode marker in brackets, or a known country) and is not a badge; (2) candidate span = non-badge lines between the title and `locIdx`; (3) if the span has ≥2 lines and the last is a bare legal form (`LEGAL_FORM`), append it to the previous line (`AlexA Pflege` + `GmbH` → `AlexA Pflege GmbH`); (4) join the span with single spaces; (5) if the span is empty, leave `company = null` **provisionally**, capture the detail header company when the pane opens, and only fail the record if both are empty |
| `location_raw` | taken from its **position**, not from a vocabulary: with two or more lines after the title, the last one is the location and everything before it is the company. A vocabulary of cities and countries is endless, and a guess silently folds the location into the company (`"Acme Tallinn, Estonia"`). The vocabulary is only used for the single-line case (a lone line that reads like a location means the card has no company line) and for the legacy form `"Munich, Bavaria, Germany · 3 hours ago · 55 applicants"`, which is split on `·`, `•` and ` - ` first |
| `city` / `country` | `country` is only set when the text **names** a country (`Germany` → `DE`); a bare `"Munich (Hybrid)"` has `country = null` and the search geography supplies the default. `city` is the first non-country segment |
| `work_mode` | parenthetical `(On-site\|Hybrid\|Remote\|Vor Ort\|Präsenz)`; else map `Remote`/`Homeoffice` → `remote`, `Hybrid` → `hybrid`, else `onsite`; unknown → `null` |
| `posted_raw` / `posted_at` | the age is matched **without an end anchor** (`^(?:Posted\s+)?(\d+)\s+(unit)\s+ago`), because LinkedIn renders the age twice inside one paragraph: the accessible copy and the sighted copy land on the same line (`"Posted 5 hours ago5 hours ago"`). The raw value is the *matched* substring, not the whole line. `Just now` → 0; `Reposted 3 days ago` → 72 h **and** `reposted = true`; German `vor 2 Tagen` → 48 h, `vor 3 Minuten` → 0.05 h, `vor 1 Stunde` → 1 h |
| `badges` | every line matching `BADGES`, **except** `Easy Apply` (it is the `easy_apply` field); `already_applied = /^(applied\|applied now\|beworben)$/i.test(line)` — the live card renders **"Applied now"**, not "Applied" |
| `easy_apply` | card badge **or** the detail-pane apply button replacing the save/apply pair |
| `salary_raw` | currency + number in either order (`85K EUR/yr`, `70K EUR/yr - 95K EUR/yr`, `€70.000`); display-only, **no score points** (§9.1) |

Two more card shapes the live page produces:

- **A promoted card can lead with a teaser line** instead of the title:
  `"Solutions Architect GenAI | €250K OTE | Fortune 100"`. The title is the first
  segment, the rest are labels. Without this rule the teaser is classified as a salary
  line and the card ends up with the company as its title.
- **A company that is nothing but a legal form** (`"GmbH"`, `"AG"`) means the name line
  is missing. The record reports **no company** rather than a partial one.

The card is a lossy view: a company split across lines, a missing location, or a promo
badge must degrade to the detail header, never to a partial string like `GmbH`.

Card parsing is validated against a fixture of **25 real cards** whose expected values
are pinned in `test/golden/cards.json` (§15.1).

### 6.5 Detail (JD) extraction

Sequence per job:

1. Read the current `currentJobId` (from URL) — call it `prevId`.
2. Click the card element carrying `componentkey="job-card-component-ref-<jobId>"`
   (or the title anchor in the fallback chain).
3. Wait for **any** of: `currentJobId === jobId`; the detail heading text changes; the
   text `About the job` / `Über die Stelle` appears. Timeout 12 s.
4. Verify identity: detail pane title must contain the card title's first 4 words, or
   `currentJobId === jobId`. Otherwise treat as a stale pane, wait 2 s, re-check once.
5. Expand: click `button:has-text("…see more")`, `button:has-text("Mehr anzeigen")`,
   `[aria-label*="see more"]` if present (not an error if absent).
6. Resolve the JD chain:

```
T0  textAnchorJD()      // the h1-h4 whose text is exactly "About the job" ->
                        //   climb to the section that holds the description
T1  [data-testid="expandable-text-box"]
T1  .jobs-description__content
T1  .jobs-box__html-content
T2  [class*="jobs-description"]
T3  largestTextBlock()  // deepest visible element with max innerText length
                        //   inside the right-hand pane, > 400 chars,
                        //   excluding nav/aside/footer ancestors
PAGE detailPageFallback() // goto /jobs/view/<id>/ and repeat T0–T3 once
                         //   (not a selector tier: a different page, same extractors)
```

7. Capture the description text (line structure preserved) **and** the innerHTML (for
   markdown).
8. Sanity gate: `jd_length >= 200` after whitespace collapse. If 200–399, mark
   `extraction.degraded = true` and queue for detail-page fallback. If `< 200` after
   fallback, mark `jd_incomplete = true`, keep the record, and assign
   `verdict = REVIEW` regardless of score (never score a stub).
9. Compute `jd_hash = sha256(normalizeWhitespace(jd_text)).slice(0, 16)`.

**The text box is empty — the section is the source of truth.** LinkedIn ships
`<p><span data-testid="expandable-text-box"><p>…</p></span></p>`. The browser repairs
that invalid nesting by closing the outer `<p>`, which leaves the text box with no
content and the description paragraphs as its siblings. Reading the text box therefore
yields an empty string. The resolver instead:

1. finds the `About the job` heading,
2. climbs to the nearest ancestor that holds more than 200 characters of text and no
   second heading, and
3. reads that section's lines, dropping the heading line and a trailing `… more`.

`largestTextBlock()` (Tier 3 generic extractor):

```js
function largestTextBlock() {
  const pane = document.querySelector('main, [role="main"], body');
  let best = null, bestLen = 0;
  for (const el of pane.querySelectorAll('div, section, article')) {
    if (!el.offsetParent) continue;
    if (el.closest('nav, header, footer, aside, [role="navigation"]')) continue;
    const len = (el.innerText || '').trim().length;
    if (len < 400) continue;
    // prefer the deepest container: skip if a child holds ≥85% of the text
    const childMax = Math.max(0, ...[...el.children].map(c => (c.innerText || '').length));
    if (childMax >= len * 0.85) continue;
    if (len > bestLen) { best = el; bestLen = len; }
  }
  return best ? { text: best.innerText.trim(), html: best.innerHTML, len: bestLen } : null;
}
```

### 6.6 Drift detection and fail-closed behavior

| Mechanism | Behavior |
|---|---|
| `allow_atomic_classes: false` | Tier 4 resolvers are compiled out unless explicitly enabled for debugging |
| Required-field exhaustion | Abort the job with `extraction_failed`; after 5 consecutive failures, abort the query; after 2 aborted queries, abort the run (exit 4) |
| Tier telemetry | Every run writes `data/linkedin-scan/extraction-health.json` with per-resolver tier counts |
| Drift warning | If Tier 1/T2 resolutions exceed 20% of total → print `⚠ SELECTOR DRIFT` and record it |
| Atomic-only assertion | If any field resolved **only** via Tier 4 → hard error (test + runtime) |
| Strict mode | `--strict-selectors`: any T4 use, or any T3 resolver outside `{cardRoot: anchor-geometry, detailJD: largest-block}` → exit 4. T3 is the *normal* path for `cardRoot`, so strict mode cannot mean "T0/T1 only" |
| Empty-result guard | A query page that yields 0 cards while `results count` text shows ≥1 → `SELECTOR_BROKEN`, not "no jobs" |
| Fixture contract | `test/selectors.test.mjs` runs against `fixtures/*.html`; failing fixture tests block release |

`data/linkedin-scan/extraction-health.json`:

```json
{
  "date": "2026-10-20",
  "run_id": "2026-10-20T09-10-00",
  "resolvers": {
    "cardRoot":     { "anchor-geometry": 118, "legacy-li": 0, "common-parent": 0, "atomic": 0 },
    "cardCompany":  { "lineBeforeLocation": 116, "secondLine": 2, "atomic": 0 },
    "detailJD":     { "text-anchor": 104, "legacy-class": 9, "largest-block": 3, "detail-page": 2, "failed": 0 }
  },
  "atomic_only": 0,
  "degraded": 3,
  "incomplete": 0,
  "drift_warning": false
}
```

### 6.7 The atomic-class mutation test (the guardrail that matters)

`fixtures/search-results.atomic-renamed.html` is identical to `search-results.html`
except that every class matching `/^(?:[a-z]{1,3})0[a-z0-9]{2,}$/` is replaced with
`rmap<n>` (`i0lax0`, `js0lk1` → `rmap0000`, `rmap0001`, …). The pattern and
the renamer live in `lib/atomic.mjs`, so the test and the capture tool cannot drift
apart. The renamed prefix is four letters — deliberately outside the pattern (which is
1–3 letters + `0` + alphanumerics), so "no obfuscated class survived" stays a
meaningful assertion. The renamer handles double-quoted, single-quoted and unquoted
`class` attributes.

The suite also proves the mutation is real **and** that it bites: injecting an
obfuscated class into either the card path or the detail path makes the mutation test
fail. (Before the review, the detail record was compared on `jd_text` only, so a class
dependency in the detail path passed — the comparison now covers the whole stable
detail record.)

Test assertion:

```
extract(fixture) === extract(atomicRenamedFixture)   // byte-identical
```

The suite also asserts that the mutation is real: the original fixture contains > 100
obfuscated class tokens, the renamed one contains none, and the two files differ only
in their `class` attributes.

If a future contributor adds an atomic-class dependency, this test fails. This is the
mechanical enforcement of the user's "do not rely exclusively on brittle classes" rule.

### 6.8 Optional Phase 4 — Voyager JSON capture

Attach a response listener during detail loads:

```js
page.on('response', async (res) => {
  if (!/\/voyager\/api\/jobs\/jobPostings\/\d+/.test(res.url())) return;
  if (!res.ok()) return;
  const json = await res.json().catch(() => null);
  if (json) capture.set(jobIdFrom(res.url()), json);
});
```

Use it only to *enrich* a DOM-extracted record (`description.text`, `listedAt`,
`companyDetails`, `workplaceTypes`), never as the sole source. Rationale: internal schema
is undocumented and changes without notice; DOM text is what the user actually sees.
Gate behind `--voyager` and keep it off by default.

### 6.9 What we deliberately will not do

- XPath by absolute position (`/html/body/div[3]/…`) — breaks on any wrapper change.
- `nth-child` chains to reach a card.
- Matching on computed background colors (`#16191C` is the dark theme; light theme differs).
- Screenshot/vision extraction for text (prior art: `qwen3-vl` hallucinated button labels;
  OCR is a last-resort diagnostic, not a pipeline).
- Text-content selectors that include dynamic data (e.g. `:has-text("<company name>")`).

---

## 7. Data model

### 7.1 `JobRecord`

```json
{
  "schema_version": 1,
  "kind": "record",
  "run_id": "2026-10-20T09-10-00",
  "source": "linkedin",
  "query": "AI/ML Berlin 24h",

  "job_id": "4454388223",
  "url": "https://www.linkedin.com/jobs/view/4454388223/",
  "url_canonical": "https://www.linkedin.com/jobs/view/4454388223/",

  "title": "Consultant Data Science & ML Engineering (m/w/d)",
  "company": "Deloitte",
  "company_norm": "deloitte",

  "location_raw": "Berlin, Germany (Hybrid)",
  "city": "Berlin",
  "country": "DE",
  "work_mode": "hybrid",
  "employment_type": "full_time",
  "seniority": "mid",

  "posted_raw": "29 minutes ago",
  "posted_at": "2026-10-20T08:41:00.000Z",
  "posted_age_hours": 0.48,
  "reposted": false,

  "badges": ["Be an early applicant", "Promoted"],
  "easy_apply": true,
  "already_applied": false,
  "salary_raw": null,

  "jd_text": "Deloitte bietet führende Prüfungs- und Beratungsleistungen …",
  "jd_markdown": "…",
  "jd_path": "jds/linkedin/deloitte_consultant-data-science-ml-engineering_2026-10-20.md",
  "jd_hash": "9f2c41ab77de0e51",
  "jd_length": 4210,

  "extraction": {
    "tiers": {
      "cardRoot": "anchor-geometry",
      "cardCompany": "lineBeforeLocation",
      "detailJD": "text-anchor"
    },
    "degraded": false,
    "incomplete": false,
    "detail_page_fallback": false
  },

  "pre_score": 78,
  "verdict": "CANDIDATE",
  "reasons": [
    "title:+Computer Vision",
    "title:+ML",
    "skill:PyTorch",
    "skill:OpenCV",
    "location:Berlin",
    "freshness:<24h",
    "seniority:mid"
  ],
  "signals": {
    "title_hits": ["ML", "Computer Vision"],
    "skill_hits": ["PyTorch", "OpenCV", "Python"],
    "blockers": [],
    "burn_list": false,
    "language": "de",
    "german_requirement": null,
    "german_nice_to_have": false,
    "min_years_required": 3
  },

  "deep": {
    "status": "scored",
    "match_10": 8.6,
    "score_5": 4.3,
    "recommendation": "APPLY",
    "cv_path": "~/Mission - Job/sanket/designer_cvs_v3/tests/extracted/master.txt",
    "cv_sha256": "b41d…9c2e",
    "report_path": "reports/125-deloitte-2026-10-20.md",
    "report_num": 125,
    "model": "gemma4:e2b",
    "scored_at": "2026-10-20T09:22:11.000Z"
  },

  "first_seen": "2026-10-20T09:14:02.000Z",
  "last_seen": "2026-10-20T09:14:02.000Z"
}
```

Rules:

- `title`, `company`, `job_id`, `url` are **required**; `jd_text` is required for any
  record that will be scored. The single exception is `already_applied` (§8.4), which may
  carry `jd_text: null`, `pre_score: null`, `deep: null`, `verdict: "APPLIED"`, and is
  excluded from the review queue.
- Missing any other required field → no record.
- `pre_score ∈ [0,100]`, or `null` iff `verdict ∈ { APPLIED, UNSCORED }`.
- `deep.match_10 ∈ [1,10]` is the **headline** CV↔JD match. It is only present when
  `deep.status = "scored"`; it is never derived from `pre_score`. An out-of-range value is
  rejected (`deep.status = "failed"`), not clamped.
- `deep.score_5 = round(match_10 / 2, 1)` is the **only** value written to the tracker's
  1–5 Score column. It is derived, never independently model-generated.
- `deep.cv_path` / `deep.cv_sha256` identify the master CV used for the score. Both are
  present when `deep.status = "scored"` and let a score be reproduced against the CV
  version.
- `signals.german_requirement` is `null`, `"nice_to_have"`, or the explicit level found
  (e.g. `"B1"`, `"B2"`, `"C1"`, `"fluent"`). Any non-null level above A2 forces
  `verdict = HARD_SKIP`.
- `signals.min_years_required` is `null` when the JD states no year count; otherwise the
  smallest explicit requirement (e.g. `3`, `5`, `7`).
- `verdict ∈ { APPLIED, UNSCORED, HARD_SKIP, SKIP, REVIEW, CANDIDATE }`.
  `UNSCORED` only comes from `--no-score`.
- `deep.status ∈ { null, scored, failed, unavailable, skipped }`.
- `company_norm` uses the shared `normalizeCompany` (§8.2).

**Deep results are patch lines, not rewrites.** The JSONL is append-only (§7.3), so Stage 2
cannot edit the record it scored. It appends a second line with the same `job_id`:

```json
{
  "schema_version": 1,
  "kind": "deep",
  "run_id": "2026-10-20T09-10-00",
  "job_id": "4454388223",
  "deep": { "status": "scored", "match_10": 8.6, "score_5": 4.3, "…": "…" }
}
```

Readers (`report`, `score`, `latest.json`) merge lines by `job_id` in file order; the last
`deep` patch wins. A full record always has `kind: "record"`; a line with `kind: "deep"`
carries no title/JD and must not be counted as a new job, deduplicated, or given an `L-NNN`
row id. This keeps the scan crash-safe (records land immediately) and the file immutable.

### 7.2 Storage layout

```
data/linkedin-scan/
├── records/2026-10-20.jsonl        ← append-only; `kind:"record"` + `kind:"deep"` lines
├── review-2026-10-20.md            ← human queue
├── latest.json                     ← summary of the newest run (dashboard/agent friendly)
├── state.json                      ← last run, counters, stop reason, backoff_until
├── extraction-health.json          ← selector tier telemetry (§6.6)
└── auth-state.json                 ← last verified auth, profile path (no secrets)
```

Global:

- `data/scan-history.tsv` — one row per job seen (dedup + repost detection).
- `jds/linkedin/<company>_<role>_<date>.md` — JD markdown, same frontmatter as the apply
  bot's `data/job-descriptions/*.md` so downstream tools read both.

`scan-history` statuses added for LinkedIn:

| status | Meaning |
|---|---|
| `candidate` | pre-score ≥ candidate threshold |
| `review` | in the middle band |
| `skipped_score` | below review threshold |
| `skipped_hard` | blocker hit (list in `reasons`) |
| `already_applied` | LinkedIn card/header shows `Applied` / `Applied now` / `Beworben` |
| `jd_incomplete` | JD could not be captured; needs manual look |
| `extraction_failed` | required field missing |

Existing statuses (`added`, `skipped_title`, `skipped_dup`, `skipped_expired`) remain valid.

### 7.3 Atomic writes

- JSONL: open append, write one line, `fsync` optional, close. Never rewrite the file.
  Stage 1 appends `kind:"record"` lines; Stage 2 appends `kind:"deep"` patch lines (§7.1).
  A patch for an unknown `job_id` is a bug: `doctor` and the run summary assert that every
  patch matches a record written in the same file.
- JSON: write `tmp` in the same directory, then `renameSync`.
- Markdown: full rewrite to tmp + rename (idempotent — re-running a report regenerates it).
- On any write error: abort the run, leave existing files untouched.

---

## 8. Deduplication

### 8.1 Keys, strongest first

| # | Key | Source | Action |
|---|---|---|---|
| 1 | `linkedin:<job_id>` | `records/*.jsonl`, `scan-history.tsv` | Skip (already processed) |
| 2 | `url:<canonical>` | `scan-history.tsv`, `pipeline.md` | Skip |
| 3 | `cr:<company_norm>::<title_norm>` | `applications.md`, `batch/tracker-additions/*.tsv` | Skip + note "already in tracker" |
| 4 | `jd:<jd_hash>` | `records/*.jsonl` | Skip (same JD reposted under a new id) |

Canonicalization:

```
canonicalUrl(u):
  drop query params: eBP, refId, trackingId, trk, originalSubdomain, position, pageNum
  drop hash
  force https://www.linkedin.com/jobs/view/<id>/
```

### 8.2 Tracker matching

Reuse the **actual** semantics of `scripts/dedup-tracker.mjs`, not an idealized version:

| Function | Real behavior (verified) |
|---|---|
| `normalizeCompany` | lowercase → drop `(`/`)` → collapse whitespace → drop every char outside `[a-z0-9 ]`. **It does not strip legal forms**, so `Deloitte GmbH` → `deloitte gmbh` and ≠ `deloitte` |
| `normalizeRole` | lowercase → `(`/`)` to space → collapse whitespace → keep `[a-z0-9 /]` |
| `roleMatch(a,b)` | strips gender tags, salary figures and the word `remote`; keeps words >3 chars; overlap when either word contains the other; true at **≥2** overlapping words |
| `parseScore` | first number found in the cell |

Two additions live in `lib/dedup.mjs` and **never** in the shared module:

- `companyMatch(a,b)` = normalized equality **or** word-boundary prefix in either
  direction (`deloitte` ↔ `deloitte gmbh`, `siemens` ↔ `siemens ag`). This closes the
  legal-form gap without changing `dedup-tracker.mjs`.
- Every fuzzy tracker match is recorded as `dedup_match: "fuzzy"` with the matched row, so
  a false positive (e.g. `Senior ML Engineer` vs `ML Engineer`) is visible in the review
  report instead of silently dropping a job.

The pure functions move to `scripts/lib/tracker-keys.mjs` **unchanged**, imported by both
`dedup-tracker.mjs` and `lib/dedup.mjs` (§11.2). The extraction is behavior-neutral: the
acceptance test runs `dedup-tracker.mjs` on a copy of the current tracker before and after
the refactor and requires byte-identical output.

### 8.3 Burn list

If `data/burn-list.tsv` exists and the company matches, set `signals.burn_list = true`
and apply `-burn_list_penalty` (default 50). Per `integrations/README.md`, a burned
company is a **warning + penalty**, never a silent skip.

### 8.4 Within-run dedup

- `jobId` set across all queries in one process (the same job appears under many keywords).
- A card showing `Applied` / `Applied now` / `Beworben` is recorded as `already_applied`
  from the card alone and is **not** visited for a JD by default
  (`keep_applied_jd: false`) — the JD adds no decision value once applied.
  The card badge is accepted as authoritative here; a detail visit is only needed if the
  user sets `keep_applied_jd: true`, in which case the pane is opened read-only and the
  header badge is cross-checked. Note this is the one place where the record is built
  without a detail visit, so `extraction.tiers.detailJD = null` is expected.

### 8.5 Repost detection

If the same `company_norm + title_norm` appears in `scan-history.tsv` with a different
`job_id` within 90 days → `reposted = true`, `-6` points, reason `repost:<date>`.
This feeds Block G (legitimacy) reasoning without duplicating the evaluator.

---

## 9. Scoring — 1–10 CV↔JD match

The headline number is **`match_10`**: how well the extracted job description matches the
**master CV**, on a 1–10 scale. It is a 1–10 score, **not** a 0–100 percentage; the 0–100
number is the Stage 1 prefilter and is labelled as such everywhere. Stage 1 never produces
the match; it is a cheap prefilter that decides which jobs are worth the LLM call. Stage 2
produces the match by reading the master CV and the JD together.

### 9.0 What the 1–10 match means

| Band | Meaning | Queue |
|---|---|---|
| **9.0–10.0** | Near-perfect: role, must-have skills, domain, seniority, and language all align; strong CV evidence for every requirement | APPLY |
| **7.5–8.9** | Strong: most must-haves are evidenced; 1–2 minor gaps that a cover letter can bridge | APPLY |
| **6.0–7.4** | Good but not clean: transferable skills, several gaps, or a level stretch | REVIEW |
| **5.0–5.9** | Partial: meaningful gaps in stack, domain, or level; apply only with a specific reason | REVIEW |
| **3.0–4.9** | Weak: substantial gaps; likely a waste of tailoring time | SKIP |
| **1.0–2.9** | Wrong role, domain, seniority, or language | SKIP |

The score is **evidence-based**, not a vibe: the prompt requires the model to cite CV
evidence for each must-have it credits, and to list uncited requirements as gaps. A hard
gate (§9.1.1) overrides the band: a B1+ German requirement or a 7+ YoE requirement is
`HARD_SKIP` regardless of what the LLM would say.

The master CV is read from `scoring.match.cv_path` (default:
`~/Mission - Job/sanket/designer_cvs_v3/tests/extracted/master.txt`). It is the same file
the existing evaluator already uses (`RESUME_TEXT_PATH`), capped at 3,000 chars. The
scanner records the CV path and a SHA-256 of the text in the run log so a score can be
reproduced against the CV version that produced it.

### 9.1 Stage 1 — deterministic prefilter (0–100)

Inputs: title, location, work mode, posted age, badges, JD text, company, tracker state.
Filters come from `portals.yml` (`title_filter.positive`, `.negative`,
`location_filter`) so tuning one file tunes both scanners. Seniority does **not** come from
`title_filter.seniority_boost` — that list intentionally includes Senior/Lead/Staff; the
scanner uses its own `seniority_light` / `seniority_heavy` lists (§5.2).

| Signal | Points | Notes |
|---|---|---|
| Title positive keyword, first hit | **+28** | case-insensitive substring |
| Each additional positive keyword | +6 (cap +12) | cap total 40 |
| Title has junior/mid/entry/graduate/trainee | +8 | `scoring.seniority_light` (scanner-owned list) |
| Title has senior/lead/staff/principal/head/director/manager/architect/expert/specialist | **−20** | `scoring.seniority_heavy`, **not** `portals.yml` `seniority_boost` (that list includes Senior/Lead/Staff by design). `--allow-senior` sets this to 0 |
| JD explicitly requires **B1/B2/C1/C2**, fluent/native German, or "Deutsch erforderlich" | **HARD_SKIP** | §9.1.1 language terms; the candidate's level is A2 |
| German listed as "nice to have" / "von Vorteil" | **−6** | not a skip; teams often work in English |
| JD explicitly requires **7+ years** | **HARD_SKIP** | junior target; see §9.1.1 experience terms |
| JD explicitly requires **5–6 years** | **−25** | `yoe:5+` reason; can still reach REVIEW with strong skills |
| JD states **0–4 years** / junior / graduate | **+6** | complements the +8 title boost |
| Location in Germany / Berlin / remote-in-DE | +14 | Berlin adds +4 → 18 |
| Location clearly outside Germany | **HARD_SKIP** | e.g. `United States`, `India`, `Remote (UK)` |
| Core skill in JD (each unique) | +3 (cap 24) | lexicon §9.1.2 |
| Secondary skill in JD | +1 (cap 6) | |
| Posted ≤ 24 h | +8 | |
| Posted ≤ 7 d | +4 | |
| Posted > 30 d | −8 | |
| `Be an early applicant` badge | +4 | freshness proxy |
| Reposted | −6 | §8.5 |
| English-language JD | +4 | language field. A German-language JD is neutral: **no penalty**, no bonus |
| LinkedIn Apply available | +3 | friction, not fit |
| Burn-list company | −50 | §8.3 |

Removed signal: **salary disclosed**. Neither the card nor the detail pane reliably shows
compensation, so a `+2` would fire only on JDs that happen to mention a range — noise
dressed as signal. `salary_raw` stays in the record for display when a JD regex finds it,
with no points.

Raw maximum is ≈121 (40 title + 8 seniority + 18 location + 24 core + 6 secondary +
8 freshness + 4 early + 4 English + 3 apply + 6 junior-YoE), so
`pre_score = clamp(0, 100, sum)`. Verdict:

```
if blocker            → HARD_SKIP (score 0)
else if score >= 55   → CANDIDATE
else if score >= 35   → REVIEW
else                  → SKIP
```

`pre_score` is a **prefilter**, not a match. It is never shown as "8/10" and never written
to the tracker's Score column. Only `deep.match_10` is the CV↔JD match.

**Seniority cap.** When the title matches `seniority_heavy` and the JD does **not**
explicitly state 0–4 years, `verdict` is capped at `REVIEW` unless `--allow-senior` is set.
The −20 penalty alone is not enough: a strong keyword match can still cross 55, get
deep-scored, and land in APPLY. The cap enforces the junior target without hiding the job;
`--allow-senior` is the explicit override. `signals.min_years_required` 0–4 lifts the cap.

`reasons[]` is mandatory for every threshold-relevant signal (it is the audit trail and
appears in the review queue).

#### 9.1.1 Hard blockers (override everything)

Each category declares **where** it is matched. Matching a blocker against the wrong
surface is the main source of false skips, so the scope is part of the contract.

| Category | Scope | Terms |
|---|---|---|
| Wrong engagement | **title only** | `werkstudent`, `working student`, `internship`, `intern `, `praktikum`, `hiwi`, `student assistant`, `student employee`, `thesis`, `part-time`, `part time`, `20h`, `15h`, `azubi`, `apprentice` |
| Wrong domain | **title only** by default; JD only as a REVIEW flag | `fpga`, `vhdl`, `verilog`, `asic`, `firmware`, `embedded`, `cobol`, `mainframe`, `sap basis`, `sap consultant`, `salesforce admin` |
| Non-technical | **title only** | `sales`, `marketing`, `recruiter`, `talent acquisition`, `account executive`, `business development`, `customer success`, `social media` |
| Language gate | **title + JD** | explicit **B1**, **B2**, **C1**, **C2**, `b1 deutsch`, `deutsch b1`, `b2 deutsch`, `c1 deutsch`, `fließend deutsch`, `fliessend deutsch`, `fließende deutschkenntnisse`, `verhandlungssicher deutsch`, `verhandlungssicher`, `muttersprache deutsch`, `deutsch als muttersprache`, `native german`, `german native`, `fluent german`, `german fluent`, `german speaking`, `sehr gute deutschkenntnisse`, `gute deutschkenntnisse`, `deutschkenntnisse erforderlich`, `deutsch erforderlich`, `german required` |
| Experience gate | **title + JD** | `7+ years`, `8+ years`, `9+ years`, `10+ years`, `mindestens 7 jahre`, `mindestens 8 jahre`, `7–10 jahre`, `7-10 years`, `senior level experience` when paired with a year count |
| Location gate | **card location + detail header only** | explicit `must be based in <non-DE country>`, `US only`, `remote (us)` |

Why the scopes differ:

- **Engagement in the JD is not a blocker.** Postings routinely say "we also consider
  working students" or "internship possible" while hiring full-time. Title-only prevents
  that.
- **Domain in the JD is a signal, not a fact.** A CV role at a robotics company can
  legitimately mention `embedded` once. Rule: if the title is neutral and the JD contains
  ≥2 *distinct* domain terms → verdict `REVIEW` with reason `domain:<terms>`, never
  `HARD_SKIP`.
- **Language in the JD is real, but only when it is a requirement.** "Verhandlungssicher
  Deutsch" / "German B2 required" is a genuine gate for an A2 candidate. A JD merely
  *written in German* is not: many Berlin teams post in German and work in English. The
  blocker only fires on explicit level/fluency/requirement phrasing; "Deutsch von Vorteil"
  or "German is a plus" is −6, not a skip.
- **Experience is parsed from explicit year counts, not from the title alone.** A "Senior"
  title already gets −20. A JD that says "5+ years" gets −25; "7+ years" is a hard skip.
  Ranges use the lower bound (`5–7 years` → 5 → penalty, not skip).
- **Location in the JD is noise.** JDs name client countries, offices and travel; only the
  card/header location describes this role.

**A2 rule of thumb:** A2 is below B1. There is no "B1 is close enough" exception in the
deterministic gate. If the JD's language requirement is ambiguous, it is a REVIEW flag, not
a skip; the LLM stage can still judge it. The one exception is an explicit B1+ level, which
is always a skip.

Deliberate corrections to the apply bot's current list — applied as a **scanner profile
overlay**, never by editing the shared list (§9.1.2):

- **Remove** `berlin only`, `munich only`, `frankfurt only`, `in-office` from hard skips for
  the scanner. The candidate is Berlin-based and Germany-wide; on-site in Berlin is a
  *positive*, and relocation within Germany is allowed. These become location points.
- **Demote** `devops engineer` via `demote_blockers` (−15) rather than a hard skip — it is
  a judgment call, not a fact.
- **Split** `senior` / `c1` style terms into `seniority` (−20) and `language` (blocker),
  because "senior" on a German posting sometimes means "experienced", while C1 German is a
  real gate.
- **Tighten the language gate from C1 to B1.** The candidate's level is A2, so B1 is
  already above it. The old list only caught C1/fluent/native and would have let B1/B2
  roles through.
- **Add the experience gate.** The apply bot's `HARD_SKIP_KW` has no year-count logic;
  the scanner adds one because the target is junior (<5 YoE), not senior.

#### 9.1.2 Skill lexicon and the overlay rule

`scripts/lib/skill-lexicon.mjs` is a **behavior-neutral extraction** of what the apply bot
already has, imported by `linkedin_batch_apply.mjs` and by the scanner:

```js
// Moved verbatim from linkedin_batch_apply.mjs — values must not change.
export const CORE_KW = [ /* current 24 entries, incl. 'ai engineer', 'ml engineer' */ ];
export const SECONDARY_KW = [ /* current 21 entries */ ];
export const HARD_SKIP_KW = [ /* current list, incl. 'in-office', 'berlin only' */ ];
export const YEARS = { /* existing honest-years map, unchanged */ };
```

Changing those values would change the apply bot's behavior, so the scanner does **not**
edit them. It applies an explicit overlay from `config/linkedin-scan.yml`:

```yaml
scoring:
  lexicon:
    extra_core: [ros2, slam, perception, neural network, segmentation]
    extra_secondary: [mlflow, weights & biases, onnx, tensorrt]
    remove_blockers: [in-office, berlin only, munich only, frankfurt only]
    demote_blockers: { devops engineer: -15 }
    blocker_scope:
      engagement: title
      domain: title            # JD hits => REVIEW flag, not skip
      non_technical: title
      language: title_and_jd
      location: header
```

The effective scanner list is `(base ∪ extra) − remove`, with `demote` converted to points.
This keeps one reviewed keyword source, two explicit behaviors, and no silent divergence:
a test asserts that `linkedin_batch_apply.mjs`'s exported `scoreRole()` returns the same
verdict for a fixed sample before and after the extraction.

Deriving from `cv.md` at runtime is rejected: the map must be reviewable and stable, and
`cv.md` is a user-layer file (DATA_CONTRACT) that updates may not read.

### 9.2 Stage 2 — 1–10 match through the existing evaluator

**Contract change** to `scripts/career_ops_cli.py`:

```
evaluate [url] [--url URL] [--jd-file PATH] [--report-num N] [--company NAME] [--role NAME]
         [--location TEXT] [--posted TEXT] [--model NAME] [--match-10] [--json]
```

| Behavior | Detail |
|---|---|
| `--jd-file` present | Skip `fetch_jd()` entirely; read text from disk |
| `url` optional | Positional becomes `nargs='?'`; error only if both `url` and `--jd-file` are missing. `--url` supplies the link for the report header when the JD came from a file |
| Prompt composition | `URL: …\nCompany: …\nRole: …\nLocation: …\nPosted: …\n\n<jd_text[:5000]>` fed to the same 7-section system prompt; with `--match-10`, section 2 becomes `MATCH (X.X/10)` and the other six sections are unchanged |
| `--match-10` | Ask for `MATCH: <X.X>/10` instead of `SCORE: <X.X>/5`; derive `score_5 = round(match_10 / 2, 1)`. Without it, behavior is unchanged |
| CV source | Reads `RESUME_TEXT_PATH` (env override honored). `deepscore.mjs` sets it from `scoring.match.cv_path`; the CLI returns `cv_path` and the SHA-256 of the text it loaded |
| `--json` | Print exactly one JSON object to stdout; human-readable logs move to stderr |
| JSON shape | `{company, role, match_10, score_5, recommendation, report_path, report_num, status, cv_path, cv_sha256}`; `match_10` is `null` when `--match-10` was not requested or the call failed |
| `--model` | Overrides `OLLAMA_MODEL` for this call |
| Backward compatibility | `evaluate <url>` with no flags behaves exactly as today, including `SCORE: x/5`, `reports/*.md`, and `batch/tracker-additions/*.tsv` |

The `--match-10` prompt must contain these rules verbatim:

```
## Candidate constraints (non-negotiable)
- German: A2. A role requiring B1, B2, C1, C2, fluent or native German is a mismatch.
  Cap MATCH at 2.9/10 and recommend SKIP.
- Experience: ~4 years, targeting junior/mid (<5 years). If the JD requires 5–6 years,
  cap MATCH at 6.0/10. If it requires 7+ years, cap MATCH at 2.9/10.
- Target roles: Python/AI developer, ML/AI engineer, computer vision.

Start with these exact metadata lines:
Company: <company>
Role: <role>
MATCH: <X.X>/10
RECOMMENDATION: <APPLY|CONSIDER|SKIP>
```

The 1–10 rubric from §9.0 is embedded in the prompt, and the model is required to cite CV
evidence for every must-have it credits. With `--match-10`, section 2 becomes
`### 2. CV MATCH (X.X/10)` (section 3 stays the `MATCH` evidence list), the `SCORE`
metadata line is replaced by `MATCH:`, and every 1–5 threshold in the prompt — including
section 5's blocker score — is rewritten to the 1–10 scale. The CLI derives `score_5`
itself. Without the flag, the prompt and output are unchanged. The master CV is already
injected by `build_eval_system_prompt()`; this is a **CV↔JD comparison**, not a keyword
count.

On a successful match, `--jd-file` still writes the report and the TSV — that is the point
of Stage 2. There is no "evaluate without writing" mode; `scan --dry-run` therefore never
invokes Stage 2 (§10.1).

`lib/deepscore.mjs`:

```js
execFile('python3', [
  'scripts/career_ops_cli.py', 'evaluate',
  '--match-10',
  '--jd-file', record.jd_path,
  '--company', record.company,
  '--role', record.title,
  '--location', record.location_raw ?? '',
  '--posted', record.posted_raw ?? '',
  '--url', record.url,
  '--json',
], {
  timeout: 300_000,
  cwd: repoRoot,
  env: { ...process.env, RESUME_TEXT_PATH: config.scoring.match.cv_path },
});
```

Mapping into the record:

| Evaluator output | `deep.*` | Verdict override |
|---|---|---|
| `match_10` 1–10 | `deep.match_10` | headline score; queue band §9.3 |
| `score_5` = `match_10 / 2` | `deep.score_5` | tracker Score column only |
| `recommendation` `APPLY` | `deep.recommendation` | APPLY only if `match_10 ≥ 7.5` |
| `recommendation` `CONSIDER` | | queue section REVIEW |
| `recommendation` `SKIP` | | verdict becomes `SKIP` |
| `MATCH:` line missing | `deep.status = failed` | keep Stage 1 verdict; log `match_missing` |
| cap hit before the call | `deep.status = skipped`, `deep.reason = "budget"` | REVIEW (`unscored`); re-score later |
| timeout / non-zero / bad JSON | `deep.status = failed` | keep Stage 1 verdict; log |
| Ollama unreachable | `deep.status = unavailable` | keep Stage 1; **never block the scan** |

The bridge writes the result as a `kind:"deep"` **patch line** (§7.1), not by editing the
record it scored: the JSONL stays append-only and crash-safe.

A missing `MATCH:` line is a **failure**, not a reason to synthesize `score × 2`. Silently
deriving a 1–10 match from a 1–5 score would hide prompt drift and violate anti-goal AG10.
The CLI validates `MATCH:` **before** writing the report or TSV; on failure it prints
`{"status":"failed","error":"match_missing"}` and exits 7, so no bogus SKIP report is
produced. The bridge marks the record `deep.status = "failed"` and the scan continues;
`--require-deep` still escalates the run to exit 6 at the end. The record keeps its Stage 1
verdict and is reported as unscored. `extract_recommendation()` still receives `score_5`,
so its existing 4.0/3.5 fallback thresholds remain valid.

The evaluator already writes the report and the tracker TSV, so no second write path is
needed. `merge-tracker.mjs` remains the only way rows enter `applications.md`. The TSV
Score field is `score_5` formatted as `4.3/5`; the report header shows both
`**Match:** 8.6/10` and `**Tracker score:** 4.3/5`.

**Pre-requisite fix (must ship with this phase):** `build_eval_system_prompt()` hardcodes
`§16b student permit (20h/week Werkstudent or full-time internship)`, `Graduating: August
2026`, and `German: B1`. The first two contradict the current CODE RED full-time directive;
the third contradicts the user-confirmed A2 level. Replace with values read from
`config/profile.yml` (`visa.status`, `visa.full_time_eligible_from`, `candidate.location`,
`languages.*`) and make the prompt's language line read `German: A2`. Test: a fixture
profile with `full_time_eligible_from: 2026-08-28` produces a prompt containing that date
and no `20h/week`; the prompt contains `German: A2` and no `German: B1`.

**Pre-requisite fix 2 (otherwise every deep call fails):** `OLLAMA_MODEL` defaults to
`gemma4:e2b-it-q4_K_M`, which is not installed; the machine has `gemma4:e2b`. Either point
the default at an installed tag, or require `OLLAMA_MODEL`/`scoring.deep_model`. A missing
model sets `deep.status = unavailable` and aborts the deep phase after the first occurrence;
the process exits 6 **only** when `--require-deep` is set (§10.1), with a one-line
`ollama list` hint. The scanner must not treat "model not found" as a generic evaluation
failure.

The CLI's 7-section layout is used as-is; with `--match-10`, only section 2 changes from
`SCORE` to `MATCH`, and the remaining six sections are untouched. A–G alignment is out of
scope (§2 N5); the scanner relies on the metadata lines `Company:`, `Role:`, `MATCH:`,
`RECOMMENDATION:` and on `extract_recommendation()`.

### 9.3 Queue semantics

Queue is derived from **`match_10` first**, then the recommendation, in this precedence
order:

| # | Condition | Queue |
|---|---|---|
| 1 | `verdict ∈ { APPLIED, UNSCORED }` | *(excluded — never shown, never deep-scored)* |
| 2 | `verdict = HARD_SKIP` | SKIP (deep never runs) |
| 3 | `deep.status = scored` and `match_10 < 5.0` | SKIP |
| 4 | `deep.recommendation = SKIP` | SKIP |
| 5 | seniority cap active (§9.1) and not `--allow-senior` | REVIEW (even with a high match) |
| 6 | `deep.match_10 ≥ 7.5` and `deep.recommendation = APPLY` | APPLY |
| 7 | `deep.status = scored` (5.0–7.4, or CONSIDER) | REVIEW |
| 8 | `jd_incomplete` | REVIEW (never a silent skip) |
| 9 | `verdict = CANDIDATE`, no deep result (cap hit, failed, or `--no-deep`) | REVIEW, labelled `unscored` — never APPLY on a prefilter alone |
| 10 | `verdict = SKIP` | SKIP |

The match is the authority; the recommendation is a consistency check. A model that says
APPLY but scores 6.8/10 lands in REVIEW; a model that says CONSIDER but scores 8.0/10 also
lands in REVIEW, and the row shows `8.0/10 · CONSIDER` so the mismatch is visible. A deep
`SKIP` demotes any non-blocked verdict. Deep scoring never resurrects a `HARD_SKIP` and
never runs for `APPLIED`. The seniority cap is checked before the match band, so a Senior
title can be REVIEW even at 8.5/10; the row shows `senior title cap` in `Why`.

`55` remains the *verdict* gate (worth Stage 2). There is **no** prefilter-only APPLY: a
record without a `match_10` is never promoted to the APPLY queue, because that would
present a 0–100 keyword score as a CV match (anti-goal AG10). When the 15-call cap is hit,
the remaining CANDIDATEs are listed under REVIEW with `unscored` and a prefilter number;
`npm run linkedin:score -- --input … --deep` scores them without re-scraping.

---

## 10. CLI, config, and outputs

### 10.1 Commands

```bash
# health
node integrations/linkedin-scan/cli.mjs doctor
node integrations/linkedin-scan/cli.mjs auth --verify
node integrations/linkedin-scan/cli.mjs auth --export-state
node integrations/linkedin-scan/cli.mjs auth --import-cookies --browser brave
node integrations/linkedin-scan/cli.mjs selectors --test --fixtures
node integrations/linkedin-scan/cli.mjs selectors --test --live
node integrations/linkedin-scan/cli.mjs selectors --capture --out fixtures/search-results.html

# discovery + match
node integrations/linkedin-scan/cli.mjs scan --query "AI/ML Berlin 24h" --limit 10 --dry-run
node integrations/linkedin-scan/cli.mjs scan                       # all configured queries, no LLM
node integrations/linkedin-scan/cli.mjs scan --no-score --limit 50
node integrations/linkedin-scan/cli.mjs scan --deep --deep-limit 15
node integrations/linkedin-scan/cli.mjs scan --since 1h --deep   # only jobs posted in the last hour
node integrations/linkedin-scan/cli.mjs scan --fixture fixtures/search-results.html --dry-run

# re-score without re-scraping
node integrations/linkedin-scan/cli.mjs score --input data/linkedin-scan/records/2026-10-20.jsonl --deep
node integrations/linkedin-scan/cli.mjs score --input … --min-score 55

# human surface
node integrations/linkedin-scan/cli.mjs report --date 2026-10-20
```

Flags:

| Flag | Default | Meaning |
|---|---|---|
| `--query <name>` | all | repeatable; matches `config.search.queries[].name` |
| `--limit <n>` | 25 | max **detail visits** per query (capped by `max_detail_per_query`) |
| `--pages <n>` | 2 | result pages **collected** per query (25 cards/page, so up to 50 cards) |
| `--max-jobs <n>` | 120 | run cap on detail visits |
| `--since <1h\|24h\|7d>` | config (`r86400`) | overrides `search.posted_within` and sets `f_TPR` to `r3600` / `r86400` / `r604800` |
| `--dry-run` | false | extract + Stage 1 **in memory**; writes no records, no `scan-history` rows, no reports, no TSVs; incompatible with `--deep` (exit 5) |
| `--no-score` | false | discovery only; still dedups and writes records with `verdict=UNSCORED`, `pre_score=null`; never appears in the review report |
| `--deep` | false | Stage 2 (1–10 CV match) on CANDIDATEs |
| `--no-deep` | false | force Stage 2 off even when a wrapper script passes `--deep` |
| `--deep-review` | false | also Stage 2 on the REVIEW band |
| `--deep-limit <n>` | 15 | hard cap on LLM calls per run |
| `--allow-senior` | false | sets `seniority_penalty` to 0 for this run |
| `--require-deep` | false | exit 6 if the deep phase cannot run (default: warn and continue) |
| `--input <path>` (score) | — | JSONL to re-score; `kind:"deep"` patch lines are merged before selection |
| `--min-score <n>` (score) | 0 | only re-score records whose merged `match_10` is ≥ this value |
| `--force` (score) | false | also re-score records that already have `deep.status = "scored"` |
| `--json` | false | machine-readable stdout |
| `--port <n>` | 9222 | CDP port |
| `--profile <dir>` | env / config | automation profile |
| `--launch` | false | call `launch-career-ops-chrome.sh` if CDP is down |
| `--fixture <path>` | — | replay a saved HTML page instead of LinkedIn; `--dry-run` is implied unless `--write` |
| `--strict-selectors` | false | fail (exit 4) on any T4 use, or on a T3 resolver outside the allowlist `{cardRoot: anchor-geometry, detailJD: largest-block}`. T3 is the normal path for `cardRoot`, so "leaves T0/T1" would always fail |
| `--capture` (selectors) | — | write the current DOM to `--out` |
| `--input <path>` (score) | — | JSONL file to re-score |
| `--min-score <n>` (score) | 0 | skip records below this pre-score |
| `--date <YYYY-MM-DD>` (report) | today | rebuild a past review report |
| `--write` (scan) | false | allow writes while replaying a fixture; without it `--fixture` implies `--dry-run` |
| `--voyager` (scan) | false | enable optional Voyage JSON enrichment (§6.8) |
| `--verify` (auth) | — | run the §4.6 auth rules and print the failing rule |
| `--export-state` (auth) | — | write `storageState` **without** injecting cookies |
| `--import-cookies` (auth) | — | one-time cookie bootstrap; requires `--browser` |
| `--browser <chrome\|brave\|chromium>` (auth) | chrome | cookie source for `--import-cookies` |
| `--test` (selectors) | — | run the resolver matrix; needs `--fixtures` or `--live` |
| `--fixtures` / `--live` (selectors) | — | resolver-matrix source (offline / real session) |
| `--capture` (selectors) | — | write the current DOM to `--out` |
| `--out <path>` (selectors) | — | capture destination |
| `--sanitize` (selectors) | true | strip nav/profile/tracking before writing a fixture; `--no-sanitize` for local-only debugging |

`--emit` does not exist in v1. `data/pipeline.md` is a URL inbox and
`cmd_pipeline()` only matches `^- \[ \] https?://…`, so `local:jds/…` rows are silently
ignored (pre-existing gap, `modes/scan.md` notwithstanding). The review report links
directly to the JD file instead of routing through the pipeline.

Exit codes: `0` ok · `2` auth failed · `3` rate limited / LinkedIn error · `4` selector
failure (fail-closed) · `5` config error · `6` deep phase unavailable or `MATCH:` missing
**only when `--require-deep` is set** · `7` a single `evaluate --match-10` call produced no
usable match (the scan continues; the record is marked failed). Without `--require-deep`,
the deep phase degrades to `unavailable`/`failed`.

`score --deep` re-evaluates the records whose **merged** `deep.status` is `null`, `failed`,
or `skipped` — i.e. exactly the ones that still need a 1–10 match. `--force` includes the
already-scored ones. New results are appended as `kind:"deep"` patch lines (§7.1); the
record lines are never rewritten.

### 10.2 Review report

`data/linkedin-scan/review-2026-10-20.md`:

```markdown
# LinkedIn Scan — 2026-10-20

Run `2026-10-20T09-10-00` · 6 queries · 118 cards · 27 new · 10 deep-scored
Gates: German A2 (B1+ skip) · junior (<5 YoE) · Python/AI/CV
Auth: ok (career-ops-chrome) · Selectors: ok (0 atomic-only, 3 degraded) · Duration 38m

## APPLY (3)

| # | Match | Company | Role | Location | Posted | Why | Links |
|---|-------|---------|------|----------|--------|-----|-------|
| L-004 | **8.6 / 10** · 78 | Deloitte | Consultant Data Science & ML Engineering (m/w/d) | Berlin (Hybrid) | 29m | CV: PyTorch, OpenCV, production CV; gaps: SAP context | [JD](jds/linkedin/…) · [job](…4454388223) · [report](reports/…) |

## REVIEW (7)

| # | Match | Company | Role | Location | Posted | Why | Links |
|---|---|---|---|---|---|---|---|
| L-005 | **6.9 / 10** · 62 | Fin | ML Engineer | Berlin (Hybrid) | 2h | strong Python/ML; gap: no fintech domain | … |
| L-008 | 41 *(prefilter)* | Fin | Senior Machine Learning Scientist | Berlin (Hybrid) | 29m | title+ML, senior(−20), no JD skills parsed | … |

## SKIP (17)

<details><summary>expand</summary>

| # | Match | Company | Role | Reason |
|---|-------|---------|------|--------|
| L-010 | 0 | Alexa Pflege | Pflegefachkraft (m/w/d) | blocker:domain |
| L-011 | 4.2 / 10 · 58 | Example GmbH | AI Engineer | match < 5.0 (domain gap) |

</details>

---
Next: open an APPLY row, read the report, tailor your CV, and apply manually.
`data/applications.md` is updated only by `merge-tracker.mjs`.
```

Row ids are `L-<NNN>` = the 1-based append ordinal in that day's `records/YYYY-MM-DD.jsonl`
(`L-004` is the 4th record that day, not a global job number). The id is stable for a given
file, and each row's Links column carries the `job_id` so a record can always be looked up
after the file is rotated.

The `Match` column shows `match_10 / 10 · pre_score`. Rows that were never deep-scored
show `prefilter` and a single 0–100 number; a CANDIDATE that missed the deep cap is
labelled `unscored` and stays in REVIEW. Neither is ever presented as a CV match. The
queue is sorted by `match_10` descending, then `pre_score` descending, then `posted_at`
ascending. A deep row whose recommendation disagrees with its band (e.g. `8.0/10 ·
CONSIDER`) keeps the number and shows the recommendation in `Why`, so the disagreement is
visible rather than hidden.

Example arithmetic: 27 new = 10 CANDIDATE + 5 REVIEW + 12 SKIP before Stage 2. All 10
CANDIDATEs are deep-scored (the 15-call cap is not reached) → 3 APPLY (≥7.5), 2 REVIEW
(5.0–7.4), 5 SKIP (<5.0). Final queue: 3 APPLY; 7 REVIEW (2 deep + 5 prefilter); 17 SKIP
(12 prefilter + 5 deep). Counts sum to 27.

`latest.json`:

```json
{
  "run_id": "2026-10-20T09-10-00",
  "finished": "2026-10-20T09:48:12.000Z",
  "queries": 6, "cards": 118, "new": 27,
  "by_verdict": { "CANDIDATE": 5, "REVIEW": 5, "SKIP": 17 },
  "queue": { "apply": 3, "review": 7, "skip": 17 },
  "match": { "scored": 10, "median": 6.4, "top": 8.6 },
  "deep": { "scored": 10, "failed": 0, "unavailable": 0 },
  "gates": { "german_a2_skipped": 3, "yoe_5_plus_penalized": 4, "yoe_7_plus_skipped": 1 },
  "auth": "ok", "selectors": "ok",
  "review_path": "data/linkedin-scan/review-2026-10-20.md"
}
```

`match.median` is the median `match_10` over deep-scored records (one decimal); `match.top`
is the maximum. `gates.*` are counts of records affected by each deterministic gate, not
queue counts — a record can be counted in both a penalty and a skip gate.

### 10.3 npm scripts

```json
"linkedin:doctor":   "node integrations/linkedin-scan/cli.mjs doctor",
"linkedin:auth":     "node integrations/linkedin-scan/cli.mjs auth --verify",
"linkedin:scan":     "node integrations/linkedin-scan/cli.mjs scan --deep --deep-limit 15",
"linkedin:discover": "node integrations/linkedin-scan/cli.mjs scan --no-deep",
"linkedin:score":    "node integrations/linkedin-scan/cli.mjs score --deep",
"linkedin:report":   "node integrations/linkedin-scan/cli.mjs report",
"linkedin:test":     "node --test integrations/linkedin-scan/test/"
```

`linkedin:scan` is the recommended daily command: discovery + a 1–10 CV match for the top
15 candidates. `linkedin:discover` is the fast, LLM-free pass for checking extraction
health, running `--dry-run`, or when Ollama is unavailable — `linkedin:scan -- --dry-run`
would conflict with the wrapper's `--deep` and exit 5. `linkedin:score --input …` re-scores
an existing JSONL without re-scraping.

---

## 11. Changes to existing files

### 11.1 New files

Everything under `integrations/linkedin-scan/` (§3.1) plus:

| File | Purpose |
|---|---|
| `scripts/lib/skill-lexicon.mjs` | Shared keywords/blockers/years |
| `scripts/lib/tracker-keys.mjs` | Shared normalization + `roleMatch` + `parseScore` |
| `scripts/lib/linkedin-url.mjs` | Job-id extraction, canonicalization, search-URL builder |
| `config/linkedin-scan.yml` | User overrides (created on first run, user layer, untracked) |
| `docs/agent-workflows/linkedin-scan.md` | Operator runbook (auth, run, read queue, recover) |
| `tests/test_career_ops_cli.py` | Unit tests for `MATCH:` parsing, `score_5` derivation, and prompt constraint lines |

**Phase 0a (implemented 2026-10-20):**

| File | Purpose |
|---|---|
| `integrations/linkedin-scan/lib/parse.mjs` | Pure text parsing: posted age, location, company span, title cleaning, job id, canonical URL |
| `integrations/linkedin-scan/lib/selectors.mjs` | DOM resolvers: card discovery, card extraction, detail-pane extraction, structure-based `textLines()` |
| `integrations/linkedin-scan/lib/inject.mjs` | Turns the modules into a classic script the page can run (`globalThis.__linkedinScan`) |
| `integrations/linkedin-scan/lib/atomic.mjs` | The obfuscated-class pattern and the deterministic renamer shared by the capture tool and the test |
| `integrations/linkedin-scan/lib/sanitize.mjs` | Personal-data guard for captures: find names, e-mails and profile links; strip profile links |
| `integrations/linkedin-scan/test/parse.test.mjs` | Unit tests for the text rules (no browser) |
| `integrations/linkedin-scan/test/selectors.test.mjs` | Fixture tests in a real Chromium (offline, `file://`) |
| `integrations/linkedin-scan/test/guards.test.mjs` | Injection guards, personal-data guard, renamer rules |
| `integrations/linkedin-scan/test/golden/cards.json` | The 25 expected card records |
| `integrations/linkedin-scan/notes/phase-0a-ledger.md` | The implementation ledger: the rulings and the review findings that shaped this phase |
| `integrations/linkedin-scan/fixtures/search-results.html` | Sanitized capture of the real results list + detail pane |
| `integrations/linkedin-scan/fixtures/search-results.atomic-renamed.html` | The same fixture with every obfuscated class renamed |
| `integrations/linkedin-scan/tools/capture-fixture.mjs` | Captures and sanitizes the fixture pair |
| `integrations/linkedin-scan/tools/update-golden.mjs` | Regenerates the golden records from the committed fixture |
| `integrations/linkedin-scan/tools/wait-auth.mjs` | Waits for a human login, then saves the storage state |
| `integrations/linkedin-scan/tools/open-login.mjs` | Opens the LinkedIn login page in the automation Chrome |

### 11.2 Modified files

| File | Change | Risk |
|---|---|---|
| `scripts/career_ops_cli.py` | `evaluate` gains `--jd-file`, `--json`, `--model`, `--match-10`, optional url; prompt reads visa + language from `profile.yml`; `MATCH: x/10` parsing + `score_5` derivation; `OLLAMA_MODEL` default points at an installed tag | Low; backward compatible |
| `config/profile.yml` | `languages.german` corrected from the stale `B1` to the user-confirmed `A2` (done 2026-10-20); `language_note` updated to match; `german_target` stays `B2` | Low; user-layer data, factual correction |
| `scripts/extract_linkedin_cookies.py` | `--browser`, keyring label map, WAL copy, atomic write | Low; additive |
| `scripts/linkedin_batch_apply.mjs` | Import `CORE_KW`/`SECONDARY_KW`/`HARD_SKIP_KW`/`YEARS` from `scripts/lib/skill-lexicon.mjs` | Medium; behaviour-neutral refactor, verify with `--dry-run` |
| `scripts/launch-career-ops-chrome.sh` | Add background-throttling flags (§4.8) | Low |
| `scripts/dedup-tracker.mjs` | Import normalization from `scripts/lib/tracker-keys.mjs` | Low; must keep output byte-identical on current data (test against a copy) |
| `package.json` | Add `linkedin:*` scripts | None |
| `docs/DATA_CONTRACT.md` | Register `data/linkedin-scan/`, `jds/linkedin/`, `config/linkedin-scan.yml` as **user** layer. `integrations/linkedin-scan/*` is deliberately **not** declared system layer because it is absent from `update-system.mjs` `SYSTEM_PATHS` (§5.2) | None |
| `modes/scan.md` | Add a "LinkedIn scanner" subsection: canonical statuses, pointer to the review report and records (no `local:` pipeline bridge — see §10.1) | None |
| `integrations/DIR_INDEX.md` | Add the new integration row | None |
| `DIR_INDEX.md` | Mention `integrations/` if not already listed | None |
| `.gitignore` | `data/linkedin-scan/`, `jds/linkedin/`, `config/linkedin-scan.yml`, `integrations/linkedin-scan/fixtures/*.local.html` | None |

### 11.3 Explicitly unchanged

`data/applications.md`, `templates/states.yml`, `modes/oferta.md`, `modes/_shared.md`
scoring weights, `merge-tracker.mjs`, `verify-pipeline.mjs`. If any of these must change,
that is a separate decision.

---

## 12. Rate limiting, session safety, compliance

### 12.1 Budgets

| Limit | Default |
|---|---|
| Delay between card clicks | 2.5–6 s (randomized) |
| Delay between result pages | 8–15 s |
| Cards collected per query | up to 50 (2 pages × 25) |
| Detail visits per query | 25 (`max_detail_per_query`) |
| Jobs per run | 120 |
| **Scan phase** wall-clock | 35 min (`max_scan_minutes`) |
| **Deep phase** wall-clock | 30 min (`deep_budget_minutes`) |
| Detail-page fallback fetches | 10 per run |
| LLM calls per run | 15 (`--deep-limit`) |
| Runs per day (recommended) | 1–2 (24 h default); hourly only with `--since 1h` |

The two clocks are separate because they answer different questions. The scan clock bounds
DOM work; the deep clock bounds Ollama. The deep loop checks its budget **before** each
call, but one call can still take up to 300 s, so the worst case is 30 min + 5 min ≈ 35 min
and the run's hard ceiling is ≈ 70 min — not the 35 min a single clock would imply. With
15 calls at the worst-case timeout, a run would otherwise take 75 min of LLM time alone,
which is exactly the contradiction this split removes. In practice `gemma4:e2b` finishes a
condensed evaluation well under a minute; the cap exists to bound a pathological run.

### 12.2 Stop conditions (no retries)

- `authwall`, `/login`, `checkpoint/challenge`, `uas/`
- HTTP 429 or 999
- 3 consecutive HTTP 5xx
- 5 consecutive extraction failures
- 2 queries returning 0 cards while the results counter shows jobs

On stop: write `state.json` with `stopped_reason` and `backoff_until`, print a one-line
operator instruction, exit non-zero. **Never retry a challenge.**

### 12.3 Compliance posture

- Personal, single-account, read-only use against the account owner's own logged-in session.
- No data about other people is collected, stored, or redistributed.
- No application submission, no messaging, no connection requests.
- No circumvention of access controls; challenges are treated as stop conditions.
- The user owns the account risk. The README states this plainly.

---

## 13. Error handling matrix

| Failure | Detection | Behavior | Exit |
|---|---|---|---|
| CDP unreachable | `connectOverCDP` throws | Print `run: bash scripts/launch-career-ops-chrome.sh` | 2 |
| Session expired | §4.6 rules | Stop, print re-auth steps | 2 |
| Authwall/challenge | URL + body text | Stop, no retry | 2 |
| Rate limited | status 429/999 | Stop, set backoff | 3 |
| Card list empty | 0 cards + results text > 0 | `SELECTOR_BROKEN` | 4 |
| Required field missing | resolver chain exhausted | Skip job, count failure per query | 0; **4** after 5 consecutive failures in one query |
| All queries aborted | 2 queries hit the 5-failure limit | Stop the run | 4 |
| Ollama model missing | model load error | `deep.status=unavailable`, stop deep phase; hint `ollama list` | 0, or 6 with `--require-deep` |
| JD too short | `< 200` after fallback | `jd_incomplete`, verdict REVIEW | 0 |
| Stale detail pane | identity check fails twice | Skip job, log | 0 |
| Ollama down | connection error | `deep.status=unavailable`, continue | 0 |
| Evaluator bad JSON | parse error | `deep.status=failed`, keep pre-score | 0 |
| `MATCH:` missing | regex miss after a successful call | No report/TSV written; print JSON `{status:"failed",error:"match_missing"}`; scanner marks `deep.status=failed` and keeps pre-score | 7 per call; 0 for the scan, or 6 with `--require-deep` |
| Config invalid | yaml/ajv-style checks | Print field path | 5 |
| Disk write error | fs throw | Abort, files untouched (atomic) | 1 |
| Chrome profile locked | `SingletonLock` live pid | Refuse to launch, print pid | 1 |

---

## 14. Logging and observability

`data/linkedin-scan/run-<run_id>.log` (and stdout):

```
09:10:02.412 run start profile=career-ops-chrome port=9222 queries=6
09:10:03.087 auth ok li_at=present
09:10:11.540 query "AI/ML Berlin 24h" page 1/2 cards=25 results_text="99+ results"
09:10:19.221 card 4454388223 "Consultant Data Science & ML Engineering (m/w/d)" @ Deloitte
09:10:19.226   dedup: new
09:10:26.884   detail: jd=4210ch via text-anchor
09:10:26.902   pre: 78 CANDIDATE [title:+ML, skill:PyTorch, location:Berlin, freshness:<24h]
09:10:27.011   saved: data/linkedin-scan/records/2026-10-20.jsonl
…
09:38:44.310   match: 8.6/10 APPLY [CV:PyTorch,OpenCV; gaps:SAP]
…
09:48:12.907 run end new=27 candidates=10 review=5 skip=12 queue=3/7/17 deep=10 duration=38m
09:48:12.910 selectors: atomic_only=0 degraded=3 drift_warning=false
```

Timestamps carry milliseconds because §17 asserts the 2.5 s minimum click delay; whole
seconds cannot prove a 2.5 s gap.

No secrets, no cookies, no full JD text in logs. JD text lives only in `jds/` and records.

---

## 15. Testing

Runner: `node --test` (built-in, zero new dependencies). Python tests untouched.

### 15.1 Fixtures

Capture once, commit. The DOM comes from a **logged-in** session, so capture is sanitized
before it is written — otherwise it would commit the user's nav name, profile photo URL,
profile URN and click-tracking ids.

```bash
# Capture needs auth (§4.4). Writes both the fixture and its atomic-renamed twin.
npm run linkedin:fixtures
# The capture keeps only the two subtrees the resolvers read — the results list and
# the selected job's detail pane — and strips scripts, styles, images, SVG, buttons,
# inline styles and every profile link.
#
# The write is GUARDED, not merely careful:
#   - the list root must not be <body> (that would pull in the page chrome)
#   - profile links (the account holder and any third party) are removed
#   - the account holder's name and e-mail are collected from the live page and
#     the result is scanned for them
#   - if anything personal survives, NO FILE IS WRITTEN (exit 5)
```

`fixtures/README.md` records capture date, URL, UI variant and the sanitizer version.

| Fixture | Contents |
|---|---|
| `search-results.html` | **25 real cards** (captured 2026-10-20, AI/ML Berlin 24 h) + the selected job's detail pane ("About the job" section, 1.2 kB description) |
| `search-results.atomic-renamed.html` | identical, every obfuscated class (`i0…`, `js0…`) renamed to `renamed<n>` |
| `test/golden/cards.json` | the 25 expected records (id, title, company, location, badges, salary) — volatile values such as the relative posting time are deliberately excluded |

### 15.2 Test matrix

| Test file | Asserts |
|---|---|
| `test/parse.test.mjs` | `29 minutes ago`, `3 hours ago`, `17 hours ago`, `Just now`, `vor 2 Tagen`, `Reposted`, `Posted 5 hours ago`, `1 day ago`; the **doubled** age LinkedIn renders (`"Posted 5 hours ago5 hours ago"`); `vor 3 Minuten`, `vor 1 Stunde`; `a minute ago`; `Reposted 3 days ago`; `Berlin (Hybrid)`, `Woltersdorf (On-site)`, `Berlin, Germany (On-site)`, `Remote`, `Germany (Remote)`, `Bangalore, India`, `Tallinn, Estonia`, `Remote (UK)`, `Berlin (Homeoffice)`, `Berlin (Vor Ort)`; a non-location string yields nulls; **multi-line company (`AlexA Pflege` + `GmbH`) parses as `AlexA Pflege GmbH`, never `GmbH`**; a bare legal form is never reported as the company; a two-word company stays one company; the location comes from its position, not from a vocabulary; a promoted card's teaser line is read as the title; card meta never leaks into the company; `Applied now` sets `already_applied`; the title double rendering is de-duplicated (including a short one); the job id is read from a `componentkey` and from a `/jobs/view/` href; the canonical URL drops every tracking parameter |
| `test/selectors.test.mjs` | the fixture loads no remote asset and the page aborts every non-`file://` request; **25 cards found with unique ids**; the title/company/location/work-mode of known cards; a multi-word company; a disclosed salary range; **no card is reported without a company**; `Easy Apply` is a field, not a badge; **the posting age is parsed** (the doubled copy LinkedIn renders); **the detail pane's time comes from the pane, not from the first card of the list**; an inline SVG label never becomes a card line; without an "About the job" section the description is empty and flagged; the extraction tiers name the strategy that actually ran; the description is > 300 characters and comes from the "About the job" section; **the 25 records match `test/golden/cards.json`**; **the atomic-renamed fixture produces byte-identical output for the cards *and* the detail record**; no field resolves through a T4 (atomic) class; the mutation is real (> 100 obfuscated tokens before, none after, text identical) |
| `test/guards.test.mjs` | the injected script has no leftover module syntax, no duplicate top-level name and parses; a module with `export default` is refused; the personal-data scan finds a name, an e-mail and a profile link; profile links are stripped; the renamer handles single-quoted and unquoted `class` attributes and leaves semantic names alone; the atomic pattern matches `js0lk1`/`i0lax0` and not `rmap0000` |
| `test/normalize.test.mjs` | canonical URL drops `eBP/refId/trackingId/trk`; job id from `/jobs/view/123`, `/jobs/view/slug-at-co-4454388223?x=1`; title gender-tag stripping |
| `test/dedup.test.mjs` | same id skipped; same URL with tracking skipped; **scanner prefix rule matches `Deloitte` ↔ `Deloitte GmbH`**; `dedup-tracker.mjs`'s own output is byte-identical before/after the `tracker-keys` extraction (fixture copy of the tracker); `roleMatch` ≥2 words; jd-hash collision skipped; burn-list penalty is not a silent skip; fuzzy match is reported as `dedup_match=fuzzy` |
| `test/prescore.test.mjs` | golden table: Werkstudent → HARD_SKIP; FPGA title → HARD_SKIP; **B1 German requirement → HARD_SKIP**; **"Deutsch von Vorteil" → −6, not skip**; **German-language JD with no level → not skipped for language**; **"5+ years" → −25 and `yoe:5+`**; **"7+ years" → HARD_SKIP**; **"3+ years" → no YoE penalty**; US-only → HARD_SKIP; CV Engineer Berlin fresh → CANDIDATE; senior title → −20 and **`portals.yml` `seniority_boost` is not the penalty source**; senior title is capped at REVIEW; `--allow-senior` zeroes the penalty and lifts the cap; Berlin on-site → positive (regression for the removed `berlin only` blocker); JD-only `embedded` yields REVIEW, not HARD_SKIP; salary mention yields no points; burn-list → −50 |
| `test/deepscore.test.mjs` + `tests/test_career_ops_cli.py` | `extract_match()` (Python) parses `MATCH: 8.6/10`, `MATCH: 8,6 / 10`, and `**MATCH:** 8.6/10`; **missing `MATCH:` with `--match-10` is `status=failed`** (no `score×2` fallback); `score_5 = round(match_10/2, 1)` for 1.0, 7.5, 8.6, 10.0; the Node bridge maps JSON to `deep.match_10`/`deep.score_5`; tracker TSV writes `score_5/5`; report header contains both `Match: 8.6/10` and `Tracker score: 4.3/5`; the JSONL reader merges a `kind:"deep"` patch over the earlier `kind:"record"` line (last write wins) and rejects a patch with an unknown `job_id` |
| `test/search-url.test.mjs` | exact param set from §5.1; `geoId=101282230`; page stepping `start=0,25,50`; `f_TPR` variants (`r3600`/`r86400`/`r604800`); `--since 1h` emits `r3600`; a non-DE `location` without `geo_id` exits 5 |
| `test/cli-dryrun.test.mjs` | `scan --dry-run --fixture` writes nothing (no records dir, no history append, no reports) and exits 0; `--dry-run --deep` exits 5; `--strict-selectors` exits 4 on a degraded fixture |

Run everything with `npm run linkedin:test` (`node --test "integrations/linkedin-scan/test/*.test.mjs"`).
The selector tests load a `file://` fixture into a real Chromium: no network, no
credentials, no LinkedIn.

### 15.3 Manual/live checks (not CI)

```bash
node integrations/linkedin-scan/cli.mjs auth --verify
node integrations/linkedin-scan/cli.mjs selectors --test --live
node integrations/linkedin-scan/cli.mjs scan --query "AI/ML Berlin 24h" --limit 5 --dry-run
npm run doctor && npm run verify
```

Live checks must be run with the user present; they consume the real session budget.

---

## 16. Rollout plan

Each phase is independently shippable and testable.

| Phase | Deliverable | Exit criteria | Status |
|---|---|---|---|
| **0a. Selector registry (offline)** | `selectors.mjs`, `parse.mjs`, `inject.mjs`, `atomic.mjs`, `sanitize.mjs`, tests, golden records | `node --test` green against committed fixtures; the **test suite** makes no network calls; atomic-renamed fixture produces identical output | **DONE 2026-10-20** — 79 tests green; 25 real cards; §6.2.1 records the five DOM findings that changed the design; the review's 4 Critical + 7 Important findings are fixed and listed in `notes/phase-0a-ledger.md` |
| **0b. Fixture capture (one-time, live)** | sanitized `fixtures/*.html`, `test/golden/cards.json`, `fixtures/README.md` | capture requires auth (§4.4); the write is refused if any personal data survives; goldens generated from the same DOM | **DONE 2026-10-20** (folded into 0a: the capture tool ships with the suite) |
| **1. Auth + discovery** | `browser.mjs`, `search-url.mjs`, `extract-cards.mjs`, `normalize.mjs`, `store.mjs`, `log.mjs`, `config.example.yml` + loader/overlay, `cli.mjs scan --no-score` | 5 jobs extracted live with non-empty required fields; dedup works on a second run; records JSONL valid; config overlay test green | — |
| **2. Detail + pre-score + report** | `extract-detail.mjs`, `prescore.mjs`, `report.mjs`, `dedup.mjs` | `review-YYYY-MM-DD.md` produced; 0 atomic-only resolutions; `scan-history.tsv` rows appended | — |
| **3. CV match bridge** | `deepscore.mjs`, `career_ops_cli.py` flags, prompt + model fixes | `--deep` yields a report + TSV; `deep.match_10` matches the report's `MATCH: x/10`; `score_5 = match_10/2`; prompt contains `German: A2`; `OLLAMA_MODEL` resolves to an installed tag; Ollama-down path degrades cleanly | — |
| **4. Hardening** | drift telemetry, detail-page fallback, `--strict-selectors`, optional Voyager capture, docs | 3 consecutive live runs with no manual selector fixes; README + runbook complete | — |

Phase 0 is split because "no network" and "capture live fixtures" cannot both be true of
one step. The offline suite is the release gate; capture is a supervised one-time action
whose output is then frozen.

Estimated effort (single implementer, TDD): Phase 0a ≈ 2 h, 0b ≈ 1 h, Phase 1 ≈ 4 h,
Phase 2 ≈ 4 h, Phase 3 ≈ 2 h, Phase 4 ≈ 4 h, config/overlay plumbing ≈ 1 h.
Total ≈ 18 h.

---

## 17. Acceptance criteria

The integration is done when **all** hold:

1. `npm run linkedin:doctor` passes: Node ≥18, Playwright chromium, CDP reachable,
   `AUTHED: true`, fixtures present, `portals.yml` filters loadable, and
   `OLLAMA_MODEL` resolves to an installed tag (warning only unless `--deep` is used).
2. `npm run linkedin:discover -- --query "AI/ML Berlin 24h" --limit 5 --dry-run` extracts
   ≥5 cards with non-empty `job_id`, `title`, `company`, and ≥1 JD > 300 chars.
3. The atomic-renamed fixture test passes (no atomic-only dependency).
4. A second identical run reports `new: 0` (dedup by id + url + company/role + jd-hash).
5. `--deep --deep-limit 2` produces two `reports/*.md` and two TSVs; each record's
   `deep.match_10` equals the `MATCH: x/10` line in its report, and `deep.score_5` equals
   `round(match_10/2, 1)` and the TSV Score field.
6. Killing Ollama mid-run leaves the scan successful with `deep.status = "unavailable"`.
7. `data/applications.md` is byte-identical before and after **every** run: the test
   hashes it (SHA-256) at start and end and compares. `git diff` cannot be used — `data/`
   is gitignored (`.gitignore:118`). For runs **without** `--deep`, `batch/tracker-additions/`
   is hashed too. With `--deep`, new TSVs are expected there and the assertion is
   "no pre-existing file changed" instead.
8. `npm run verify` passes after a run.
9. Delays stay within the configured window (assert from the millisecond run-log
   timestamps; `min_delay_ms` has no tolerance).
10. A simulated 429 stops the run with exit 3 and writes `backoff_until`.
11. A simulated authwall stops the run with exit 2 and no retries in the log.
12. `review-YYYY-MM-DD.md` contains an APPLY/REVIEW/SKIP split, is sorted by `match_10`
    descending, every deep-scored row has a `Match` value, every unscored row is labelled
    `unscored`/`prefilter`, and every row has a concrete `Why`.
13. **A2 German gate.** A fixture JD containing `German B1`, `Deutsch B2`,
    `verhandlungssicher Deutsch`, or `Deutsch erforderlich` yields `HARD_SKIP` and never
    reaches the deep stage. A German-language JD with no explicit level is not skipped for
    language alone.
14. **Junior gate.** `5+ years` yields −25 and reason `yoe:5+`; `7+ years` yields
    `HARD_SKIP`; `3+ years` yields no penalty. A senior title yields −20 and is capped at
    REVIEW (not deep-scored by default) unless the JD states 0–4 years or `--allow-senior`
    is set.
15. **Freshness flag.** With the shipped default config, `scan` emits `f_TPR=r86400`;
    `--since 1h` emits `f_TPR=r3600`; `--since 7d` emits `f_TPR=r604800`.
16. **CV match provenance.** The deep report shows `Match: x.x/10`, the run log records the
    CV path and SHA-256, `latest.json.match.scored` equals the number of records with
    `deep.status = "scored"`, and every `kind:"deep"` patch line matches a `kind:"record"`
    line for the same `job_id` in the same file.
17. **Prompt correctness.** The `--match-10` system prompt contains `German: A2`, the
    master CV text, `MATCH: <X.X>/10`, and the 5+ / 7+ YoE rules; it contains no
    `German: B1` line, no `20h/week`, and no `/5` scoring text.

Mechanism for 10/11: `lib/browser.mjs` exports a pure
`classifyStop({ status, url, bodyText }) → 'auth' | 'rate' | 'server' | null`. Tests call
it directly for the classifier table, then run `scan --fixture fixtures/authwall.html`
(a saved `/uas/login` page) to prove the process exits 2 without a second navigation. No
live LinkedIn request is used to simulate a failure.

---

## 18. Risks and open questions

### 18.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LinkedIn redesigns the card layout again | High (already happened once in 2026) | High | Tiered resolvers + geometry + drift telemetry + fixture test |
| Atomic-class dependency creeps in via a "quick fix" | Medium | High | Atomic-renamed fixture test fails the build |
| Account restriction from automation | Medium | High | Conservative budgets, stop conditions, no concurrency, no applying |
| Evaluator prompt bias (stale visa text) | **Certain today** | Medium | Fix in Phase 3 with a prompt test |
| `OLLAMA_MODEL` tag not installed | **Certain today** | High for `--deep` | Phase 3 pre-requisite + `doctor` check (§9.2) |
| Apply bot and scanner diverge on keyword lists | High if duplicated | Medium | Shared `scripts/lib/skill-lexicon.mjs` |
| Virtualized list hides cards | Medium | Medium | Scroll-until-stable + id-keyed dedup + `--pages` |
| Detail pane shows the previous job | Medium | Medium | Identity check against `currentJobId` + title |
| Ollama slow (300 s timeouts) | Medium | Low | `--deep-limit`, sequential, non-blocking failure |
| Tracker duplication | Low | High | Single merge path, same fuzzy matcher as `dedup-tracker.mjs` |
| Scope creep into auto-apply | Medium | High | Non-goal N1; README repeats it; no apply code in the integration |
| Language gate false positive ("Deutsch von Vorteil" read as required) | Medium | Medium | Requirement-phrasing-only regex + §15.2 positive/negative fixtures; ambiguous ⇒ REVIEW, not skip |
| YoE parser false positive (range or "5+ years preferred") | Medium | Medium | Parse explicit counts, use the lower bound of ranges, treat "preferred/wünschenswert" as −10 not skip; fixtures for 3/5/6/7/10 |
| Master CV path missing or changed | Medium | High for `--deep` | `doctor` checks the resolved path + SHA-256; missing CV ⇒ `deep.status=unavailable`, exit 6 only with `--require-deep` |
| Local model inflates the 1–10 match | Medium | Medium | Evidence citation required; deterministic hard gates; calibrate against 10 hand-scored JDs before trusting the queue |

### 18.2 Resolved decisions and open questions

The following were open in the previous draft and are now decided:

| Topic | Decision |
|---|---|
| **Read-only handoff** | **Strictly read-only.** The scanner never triggers the apply bot, never opens an apply flow, and never submits. Its output is a ranked queue + a tailoring report (JD, CV evidence, gaps, ATS keywords); Sanket applies manually. |
| **Freshness window** | **24 h default** (`f_TPR=r86400`). `--since 1h` (`r3600`) and `--since 7d` (`r604800`) are available. The 1 h preset is for frequent runs, not a magic multiplier. |
| **Deep scoring trigger** | `npm run linkedin:scan` runs `scan --deep --deep-limit 15` — the recommended daily command. `linkedin:discover` is the LLM-free pass; `score --deep` re-scores an existing JSONL. |
| **Match scale** | **1–10 CV↔JD match** (`match_10`) is the headline. The tracker's 1–5 Score column receives `score_5 = match_10 / 2`; no 1–5 number is presented as the match. |
| **German level** | Sanket has **A2**. Explicit B1/B2/C1/C2, fluent/native, or "Deutsch erforderlich" is a **hard skip**. A German-language JD alone is neutral. |
| **Junior target** | Target is **<5 years**. 5–6 years required → −25; 7+ years → hard skip. Junior/mid titles keep +8. |
| **Role focus** | Python/AI developer, ML/AI engineer, computer vision. Wrong-domain and non-technical titles stay hard skips. |
| **`profile.yml` language** | The file said B1; it was stale and has been corrected to **A2** (2026-10-20). The evaluator prompt still hardcodes `German: B1` — Phase 3 makes the prompt read `profile.yml` instead. |

Still open:

1. **Already-applied jobs.** Keep them in records for analytics, or drop them entirely?
   *Spec keeps them as `verdict=APPLIED`, no JD, excluded from the queue.*
2. **Storage.** JSONL + TSV (proposed, no new deps) or SQLite (better querying, new dep)?
3. **Scheduling.** Should Phase 4 include a systemd user timer / cron entry at 08:00?
4. **Seniority penalty.** `portals.yml` says "no penalty for senior", but the target is
   junior–mid and this spec applies −20 to Senior/Lead/Staff. Keep −20, soften to −10, or
   set 0 and let the LLM judge seniority in Stage 2?
5. **Legacy geoId.** Should the one-line fix to `scripts/linkedin_scan.py:81`
   (`91000000` → `101282230`) ship with this work, or stay in its own change? *Spec leaves
   it out of scope.*
6. **The truncated instruction.** Your brief ended at
   "**Selector Resilience:** Do NOT rely exclusively on brittle" — confirm nothing after
   that was lost (e.g. a specific selector requirement or a ban on a technique).

---

## 19. Appendices

### A. Selector inventory (current, for reference only)

Present in `linkedin_batch_apply.mjs` today; these are the *starting points*, not the plan:

```
cards            li:has(a[href*="/jobs/view/"])
list pane        .jobs-search-results-list
company          .job-details-jobs-unified-top-card__company-name
                 .jobs-unified-top-card__company-name
                 a[data-field="company"]
                 .topcard__org-name-link
jd               .jobs-description__content
                 .jobs-box__html-content
                 .job-details-jobs-unified-top-card__description-container
                 .jobs-search__job-details--container
                 .description__text
apply            button.jobs-apply-button
modal            .jobs-easy-apply-modal
filters          div[role=radio][aria-checked]
consent          .artdeco-global-alert--COOKIE_CONSENT button:has-text("Accept")
```

Vault-verified 2026-08-14 on the **older** surface. Several are absent from the new
`search-results` UI in the screenshots, which is exactly why the spec does not depend on
them.

### B. Search URL examples

```text
# 24h, Berlin 80 km, AI/ML
https://www.linkedin.com/jobs/search-results/?keywords=AI%20ML&location=Berlin&geoId=101282230&distance=80&f_AL=true&f_E=2%2C3%2C4&f_JT=F&f_TPR=r86400

# Germany-wide, 7 days, computer vision
https://www.linkedin.com/jobs/search-results/?keywords=Computer%20Vision&location=Germany&geoId=101282230&f_AL=true&f_E=2%2C3%2C4&f_JT=F&f_TPR=r604800

# page 2
…&start=25
```

### C. Glossary

| Term | Meaning |
|---|---|
| **Atomic class** | Generated CSS class (`i0lax0`) with no semantic meaning; changes between deploys |
| **CDP** | Chrome DevTools Protocol; Playwright attaches to a running Chrome over it |
| **Tier** | Selector stability rank T0 (most stable) → T5 (least) |
| **Pre-score** | Deterministic 0–100 prefilter, no LLM; never presented as the CV match |
| **Match (`match_10`)** | 1–10 CV↔JD match from `career_ops_cli.py --match-10` (master CV + extracted JD; condensed 7-section prompt, not an A–G report) |
| **Tracker score (`score_5`)** | Derived `match_10 / 2`, one decimal; the only value written to the tracker's 1–5 Score column |
| **A2 gate** | Hard skip for explicit B1+ / fluent / native German requirements; a German-language JD alone is neutral |
| **YoE gate** | 5–6 years required → −25; 7+ years → hard skip; junior target is <5 years |
| **CANDIDATE** | Pre-score ≥ 55; eligible for deep scoring |
| **Fail-closed** | Stop/skip loudly rather than emit a record with empty fields |
| **Drift** | The UI changed such that lower-tier resolvers start doing the work |

---

**End of specification.**
