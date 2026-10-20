# Daily Berlin AI + Retail/Inventory Scanner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 151 new Berlin AI/retail companies into `portals.yml` and build a daily scanner that visits every tracked career page, extracts only AI/Python/Software/ML developer roles (never logistics or marketing), filters to a 7-day posting window (keeping undated roles), and writes a per-company daily digest plus a machine-readable TSV.

**Architecture:** A new `scripts/lib/` layer splits the scanner into three testable units: ATS provider adapters (JSON/XML API parsers for 10 platforms), an HTML extraction fallback (generic anchor heuristic + Playwright for JS-rendered boards), and a role filter (date window + strict title matching). `scripts/scan.mjs` is refactored to orchestrate them: detect provider → fetch via API, else HTML → Playwright fallback → filter → dedup → write digest + pipeline + history.

**Tech Stack:** Node 20 ESM, `js-yaml`, `playwright` (chromium-1248 verified working), `node:test` + standalone `node scripts/test-*.mjs` harnesses matching existing repo convention.

**Spec:** `research/berlin-ai-retail/README.md` (company list, source URLs) — this plan consumes that list as its input data.

## Global Constraints

- Repo root is `/home/sanket758/Projects/german-career-ops`. All paths below are relative to it.
- Node ESM (`.mjs`), `import`/`export`, no TypeScript, no new npm dependencies.
- `portals.yml` is the single source of truth for tracked companies, title filters and location filters. Never hardcode a company list in a script.
- Normalized job shape is exactly: `{ title: string, url: string, company: string, location: string, date: string|null, provider: string }` where `date` is ISO-8601 (`YYYY-MM-DD`) or `null`.
- Existing `data/scan-history.tsv` header is `url\tfirst_seen\tportal\ttitle\tcompany\tstatus` — append only, never rewrite.
- Existing `data/pipeline.md` has a `## Pendientes` section — append new rows there, never reorder existing rows.
- All network fetches get a 20s timeout and a browser-like `User-Agent`; failures must be caught per-company and never abort the run.
- Never print credentials, cookies, or `data/linkedin_storage_state.json` contents.
- Deduplicate a URL seen in the same run: first occurrence wins, later ones are dropped.
- Do NOT touch `scripts/linkedin_batch_apply.mjs` or anything under `integrations/` — out of scope.
- The daily digest MUST list every scanned company (including zero-result and error rows) so the user can see coverage per career page.

## Review Focus

Failure modes the spec implies that are most likely to bite a user — each gets a test in the owning task:

1. **A company whose board returns 200 but contains zero job links** (empty board, or a JS app that renders nothing) — must report "no roles found", not crash and not be silently skipped.
2. **A role whose title contains a positive substring inside another word** (e.g. "Software **AI**nabled" style, or "Logist**ic**s") — short keywords must match on word boundaries, as `buildTitleFilter` already guarantees.
3. **A role with no parseable date on a plain HTML career page** — must be kept and labelled `undated`, not dropped by the 7-day window.
4. **A 403 bot-wall on a career page** (Personio/Workday/join.com do this) — must be recorded as `error` for that company and must not abort the other 150 companies.
5. **The same job listed on two different company boards (or a re-posted role with a new URL)** — must produce exactly one digest row, decided by first-seen-wins against `scan-history.tsv`.
6. **A role in German** ("Entwickler (m/w/d) Python", "KI Ingenieur") — must be matched by the filter, not silently dropped as non-English.

---

### Task 1: Wire 151 companies into `portals.yml` + tighten the title filter

**Files:**
- Modify: `portals.yml` (append to `tracked_companies:`; edit `title_filter.positive` and `title_filter.negative`)
- Create: `scripts/apply-tracked-companies.mjs` (one-off idempotent wiring script)
- Test: `scripts/test-portals-wiring.mjs`

**Interfaces:**
- Consumes: `research/berlin-ai-retail/berlin-ai-retail-companies.csv` (columns: `company`, `careers_url`, `careers_host`, `careers_type`, `website`)
- Produces: `portals.yml` with `tracked_companies` entries in this exact shape:
  ```yaml
  - name: <company>
    careers_url: <url>
    api: <url>            # ONLY for greenhouse boards
    scan_method: websearch
    scan_query: 'site:<host> ("AI" OR "Machine Learning" OR "Data" OR "Computer Vision" OR "Deep Learning")'
    notes: "<sector>. <kind>."
    priority: tier1
    enabled: true
  ```

- [ ] **Step 1: Write the failing test** `scripts/test-portals-wiring.mjs` — it must assert, after wiring:
  - `portals.yml` parses as YAML.
  - `tracked_companies` has 151 more entries than before the wiring (record the "before" count in the script as a literal `132` and assert `>= 280` total, since 4 of the new names overlap existing ones by normalized name).
  - Every newly added entry has a non-empty `careers_url` starting with `http`.
  - No two entries share the same `careers_url`.
  - No entry is missing `priority` / `enabled`.
  - `title_filter.positive` contains `Software Engineer`, `Software Developer`, `Developer`, `Software`.
  - `title_filter.negative` contains `Logistics` and `Logistik`.
  - `title_filter.negative` still contains `Marketing`, `Supply Chain`, `Backend` (case-sensitive check on the literal strings) — the negative list must keep winning over positives.

- [ ] **Step 2: Run the test to verify it fails**
  Run: `node scripts/test-portals-wiring.mjs`
  Expected: FAIL with "FAIL  tracked_companies count" (currently 132).

- [ ] **Step 3: Implement `scripts/apply-tracked-companies.mjs`**
  - Read `research/berlin-ai-retail/berlin-ai-retail-companies.csv`.
  - Skip rows with empty `careers_url`.
  - Normalize names (strip accents, lowercase, drop parentheticals) and skip any whose normalized name already exists in `tracked_companies` — this is what keeps the count at 151 additions rather than 155.
  - Emit the entry shape above. For greenhouse hosts (`job-boards.greenhouse.io/<slug>` or `job-boards.eu.greenhouse.io/<slug>`) also emit `api: https://boards-api.greenhouse.io/v1/boards/<slug>/jobs` and omit `scan_method`/`scan_query` (the API path is used instead).
  - Append the block to the end of the `tracked_companies:` list in `portals.yml` — read the file as text, find the last `  - name:` line, and insert after its block; do NOT rewrite the YAML with js-yaml (that would reformat the whole 60KB file and destroy the user's comments).
  - The script must be idempotent: running it twice must add 0 rows the second time.
  - Print `ADDED: N  SKIPPED_EXISTING: M`.

- [ ] **Step 4: Run the wiring script**
  Run: `node scripts/apply-tracked-companies.mjs`
  Expected: `ADDED: 151  SKIPPED_EXISTING: 4` (or `151`/`151` on a second run showing idempotency).

- [ ] **Step 5: Edit `portals.yml` `title_filter`**
  - Add to `positive`: `"Software Engineer"`, `"Software Developer"`, `"Developer"`, `"Software"`.
  - Add to `negative`: `"Logistics"`, `"Logistik"`, `"Backend"` (the last one extends the existing `"Backend Engineer"` negative to cover `"Backend Developer"`).
  - Do NOT add `"Warehouse"` to negatives — warehouse computer-vision roles are within the user's stated target area. Leave a one-line comment next to it saying so, so the choice is reversible.
  - Do NOT remove any existing positive or negative.

- [ ] **Step 6: Run the test to verify it passes**
  Run: `node scripts/test-portals-wiring.mjs`
  Expected: all cases PASS.

- [ ] **Step 7: Commit**
  ```bash
  git add portals.yml scripts/apply-tracked-companies.mjs scripts/test-portals-wiring.mjs
  git commit -m "feat(scan): wire 151 Berlin AI/retail companies into portals.yml and tighten title filter"
  ```

---

### Task 2: ATS provider adapters

**Files:**
- Create: `scripts/lib/ats-providers.mjs`
- Create: `scripts/test-ats-providers.mjs`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  ```js
  export function detectProvider(careersUrl: string): Provider | null
  export async function fetchFromProvider(provider: Provider, companyName: string): Promise<Job[]>
  // Provider = { type: string, url: string, slug: string, host: string }
  // Job = { title, url, company, location, date, provider }
  ```
  `detectProvider` returns `null` for any URL with no known API — the caller then falls back to HTML.

- [ ] **Step 1: Write the failing test** `scripts/test-ats-providers.mjs` — table-driven, no network. Cases (URL → expected `type`):

  | careers_url | expected type |
  |---|---|
  | `https://job-boards.greenhouse.io/hive` | `greenhouse` |
  | `https://job-boards.eu.greenhouse.io/hive` | `greenhouse` |
  | `https://boards.greenhouse.io/refurbed` | `greenhouse` |
  | `https://jobs.ashbyhq.com/n8n` | `ashby` |
  | `https://jobs.lever.co/Packmatic` | `lever` |
  | `https://jobs.eu.lever.co/lovehoneygroup` | `lever` |
  | `https://mercanis.jobs.personio.de/` | `personio` |
  | `https://7learnings.jobs.personio.de/` | `personio` |
  | `https://nomitri.recruitee.com/` | `recruitee` |
  | `https://careers.smartrecruiters.com/Flink3` | `smartrecruiters` |
  | `https://jobs.smartrecruiters.com/JobsForHumanity` | `smartrecruiters` |
  | `https://aklamio.bamboohr.com/careers` | `bamboohr` |
  | `https://misterspex.wd103.myworkdayjobs.com/de-DE/Mister_Spex_Careers` | `workday` |
  | `https://join.com/companies/mellohqcom` | `join` |
  | `https://home24.career.softgarden.de/` | `softgarden` |
  | `https://www.kittl.com/careers` | `null` |
  | `https://lilt.com/careers` | `null` |

  Plus parser tests using inline JSON/XML fixtures (no network) for `greenhouse`, `lever`, `ashby`, `recruitee`, `smartrecruiters`, `bamboohr` and the Personio XML, asserting the normalized `Job` fields — in particular `date` is `YYYY-MM-DD` or `null`, and `url` is absolute.

- [ ] **Step 2: Run the test to verify it fails**
  Run: `node scripts/test-ats-providers.mjs`
  Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/lib/ats-providers.mjs`**
  Implement exactly these endpoint/field mappings, all verified live on 2026-10-20:

  | type | endpoint | parse | date field |
  |---|---|---|---|
  | `greenhouse` | `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` | `jobs[]` → `title`, `absolute_url`, `location.name`, `updated_at` | `updated_at` (also prefer `first_published` if present) |
  | `ashby` | `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` | `jobs[]` → `title`, `jobUrl`, `location`, `publishedAt` | `publishedAt` |
  | `lever` | `https://api.lever.co/v0/postings/{slug}` or `https://api.eu.lever.co/v0/postings/{slug}` when the careers URL host is `jobs.eu.lever.co` | array → `text`, `hostedUrl`, `categories.location`, `createdAt` | `createdAt` |
  | `personio` | `https://{slug}.jobs.personio.{de\|com}/xml` | XML `<position>` → `name` (title), `id` (URL `https://{slug}.jobs.personio.{tld}/job/{id}`), `office` (location), `created`/`valid-through` | `created` if present else `null` |
  | `recruitee` | `https://{slug}.recruitee.com/api/offers/` | `offers[]` → `title`, `url`, `location`, `created_at` | `created_at` |
  | `smartrecruiters` | `https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=100` | `content[]` → `name` (title), `id` (URL `https://jobs.smartrecruiters.com/{slug}/{id}`), `location.fullLocation`, `releasedDate` | `releasedDate` |
  | `bamboohr` | `https://{slug}.bamboohr.com/careers/list` | `result[]` → `jobOpeningName`, `id` (URL `https://{slug}.bamboohr.com/careers/{id}/detail`), `atsLocation.city` | `null` (not provided) |
  | `workday` | POST `https://{host}/wday/cxs/{company}/{site}/jobs` with `{"appliedFacets":{},"limit":20,"offset":0,"searchText":""}`; paginate `offset` by 20 until `total` reached (cap 5 pages) | `jobPostings[]` → `title`, `externalPath` (prefix with the board origin), `postedOn` (often `null`) | `postedOn` |
  | `join` | GET `https://join.com/companies/{slug}`; parse the embedded JSON blob | `jobs.items[]` → `title`, `idParam` (URL `https://join.com/companies/{slug}/jobs/{idParam}`), `city.cityName`, `createdAt` | `createdAt` |
  | `softgarden` | GET `https://{host}/vacancies`; parse HTML anchors | anchors matching `../job/{id}/{title}` → title from the anchor's URL segment (decoded), URL absolute, location `null` | `null` |

  Notes that MUST be honoured:
  - `lever` API host differs by board region (`api.lever.co` vs `api.eu.lever.co`) — derive it from the careers URL host, never hardcode one.
  - `personio` XML is served on the `.de` or `.com` apex of the careers URL — derive `{slug}.jobs.personio.{tld}` from the careers URL, never guess.
  - `smartrecruiters` careers URLs may sit on `jobs.smartrecruiters.com/{slug}` or `careers.smartrecruiters.com/{slug}`; the API always lives on `api.smartrecruiters.com/v1/companies/{slug}/postings`.
  - `join` embedded JSON: locate the `"jobs":{"items":[` array inside the HTML's inline JSON. Do not regex the whole document for titles — parse the JSON payload. If the payload cannot be isolated, return `[]` (do not throw).
  - Every parser must return `[]` rather than throwing on an unexpected shape.

- [ ] **Step 4: Run the test to verify it passes**
  Run: `node scripts/test-ats-providers.mjs`
  Expected: all cases PASS.

- [ ] **Step 5: Add a live smoke test (opt-in, skipped by default)**
  Add to `scripts/test-ats-providers.mjs` a `--live` flag that fetches 3 real boards (`greenhouse/hive`, `ashby/n8n`, `personio/mercanis`) and asserts `jobs.length > 0` for each. Without `--live` the script must not touch the network.

- [ ] **Step 6: Run the live smoke test**
  Run: `node scripts/test-ats-providers.mjs --live`
  Expected: `PASS greenhouse  PASS ashby  PASS personio`.

- [ ] **Step 7: Commit**
  ```bash
  git add scripts/lib/ats-providers.mjs scripts/test-ats-providers.mjs
  git commit -m "feat(scan): add ATS provider adapters for 10 job-board platforms"
  ```

---

### Task 3: HTML extraction + Playwright fallback

**Files:**
- Create: `scripts/lib/html-jobs.mjs`
- Create: `scripts/test-html-jobs.mjs`

**Interfaces:**
- Consumes: nothing (pure module; takes HTML strings in).
- Produces:
  ```js
  export function extractJobsFromHtml(html: string, companyName: string, baseUrl: string): Job[]
  export async function extractJobsWithBrowser(careersUrl: string, companyName: string): Promise<Job[]>
  ```

- [ ] **Step 1: Write the failing test** `scripts/test-html-jobs.mjs` — inline HTML fixtures, no network:
  - Fixture A — a plain careers page with anchors `<a href="/jobs/senior-ml-engineer">Senior ML Engineer</a>` → exactly 1 job, title `Senior ML Engineer`, absolute URL `https://example.com/jobs/senior-ml-engineer`, `date: null`, `provider: 'html'`.
  - Fixture B — a page whose links are `href="/careers"`, `href="/jobs"` (no slug), `href="/impressum"`, `href="/privacy"` → 0 jobs. These must NOT be treated as job links.
  - Fixture C — an anchor with empty text but a job-looking href → 0 jobs (no title to report).
  - Fixture D — a German page: `<a href="/stellenangebote/entwickler-python-m-w-d">Entwickler Python (m/w/d)</a>` → 1 job, title preserved with umlauts.
  - Fixture E — relative href `../job/68210131/Some-Role` → absolute URL resolved against `baseUrl`.
  - Fixture F — a link whose text is 200 characters → rejected (title sanity cap of 160 chars).
  - Fixture G — a page containing `</script><script>` and nested quotes inside an href → parser must not throw.

- [ ] **Step 2: Run the test to verify it fails**
  Run: `node scripts/test-html-jobs.mjs`
  Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/lib/html-jobs.mjs`**
  - `extractJobsFromHtml`: regex-scan for `<a ... href="...">...</a>` pairs.
    - A href is a job link when it matches `/(job|jobs|karriere|career|stellenangebot|vacanc|position|opening|stellenanzeige)/i` **and** the path segment count after that keyword is ≥ 1 (so `/careers` alone and `/jobs` alone are rejected).
    - Title = the anchor's inner text, collapsed whitespace, trimmed, 3–160 chars. Strip nested tags and HTML entities (`&amp;` → `&`).
    - URL = resolved absolute against `baseUrl` via `new URL(href, baseUrl).href`.
    - `date` = `null` (plain pages carry no date; the digest labels them `undated`).
    - Dedupe by absolute URL within the page.
  - `extractJobsWithBrowser(careersUrl, companyName)`:
    - `chromium.launch({ headless: true })`, `newPage()`, `goto(careersUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })`, `waitForTimeout(2500)`.
    - Take `page.content()` and run the same `extractJobsFromHtml` over it with `baseUrl = careersUrl`.
    - Always `browser.close()` in a `finally` block.
    - On any error, return `[]` — never throw (the caller records the company as `error`).
    - Reuse a single browser instance across all companies that need it: export a `createBrowserSession()` that lazily launches one browser and exposes `fetchPage(url)` and `close()`. The orchestrator creates one session per run, not one per company.

- [ ] **Step 4: Run the test to verify it passes**
  Run: `node scripts/test-html-jobs.mjs`
  Expected: all cases PASS.

- [ ] **Step 5: Add a live smoke test (opt-in)**
  Add `--live` to `scripts/test-html-jobs.mjs` that runs `extractJobsWithBrowser` against `https://www.hive.app/careers` and asserts `jobs.length >= 1` and that every returned URL is absolute.

- [ ] **Step 6: Run the live smoke test**
  Run: `node scripts/test-html-jobs.mjs --live`
  Expected: `PASS  >= 1 jobs from browser`.

- [ ] **Step 7: Commit**
  ```bash
  git add scripts/lib/html-jobs.mjs scripts/test-html-jobs.mjs
  git commit -m "feat(scan): add HTML job extraction with Playwright fallback"
  ```

---

### Task 4: Role filter — 7-day window + strict title matching

**Files:**
- Create: `scripts/lib/role-filter.mjs`
- Create: `scripts/test-role-filter.mjs`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  ```js
  export function buildTitleFilter(titleFilter: {positive?: string[], negative?: string[]}): (title: string) => boolean
  export function buildDateWindow(days: number, now?: Date): (job: Job) => { keep: boolean, reason: 'in_window'|'undated'|'too_old', ageDays: number|null }
  export function buildLocationFilter(locationFilter: {positive?: string[], negative?: string[]}): (location: string) => boolean
  ```
  `buildTitleFilter` MUST be the same word-boundary logic that `scripts/scan.mjs` already implements (short keywords ≤ 3 chars match whole words only), moved here and re-exported so both files use one implementation.

- [ ] **Step 1: Write the failing test** `scripts/test-role-filter.mjs`:
  Title filter cases (positive list = the new `portals.yml` list: `AI, ML, Machine Learning, Python, Software Engineer, Software Developer, Developer, Data Engineer, KI, Robotics, …`; negative list = `Marketing, Sales, Logistics, Logistik, Supply Chain, Backend, Frontend, Product Manager, Werkstudent, Praktikum, …`):
  - `['Senior ML Engineer (m/f/d)', true]`
  - `['Software Engineer – Retail AI', true]`
  - `['Software Developer (Python)', true]`
  - `['Python Developer', true]`
  - `['Backend Developer', false]` (negative `Backend` wins)
  - `['Frontend Developer', false]`
  - `['Logistics Software Developer', false]` (negative `Logistics` wins)
  - `['Logistik Datenanalyst', false]`
  - `['Supply Chain Data Analyst', false]`
  - `['Marketing Automation Engineer', false]`
  - `['Product Manager AI', false]`
  - `['Werkstudent Machine Learning', false]`
  - `['Team Lead, Paid Search', false]` (regression: "Paid" must not match "ai")
  - `['Storage Engineer', false]` (regression: must not match "rag")
  - `['HTML Developer', false]` (regression: must not match "ml")
  - `['Entwickler (m/w/d) Python', true]` (German title)
  - `['KI Ingenieur (m/w/d)', true]`
  Date-window cases, with `now = 2026-10-20`:
  - `date '2026-10-19'` → `keep: true, reason: 'in_window', ageDays: 1`
  - `date '2026-10-13'` → `keep: true` (exactly 7 days)
  - `date '2026-10-12'` → `keep: false, reason: 'too_old'`
  - `date null` → `keep: true, reason: 'undated', ageDays: null`
  Location filter cases: `''` → `true` (unknown location passes, to be reviewed manually); `'Berlin'` → `true`; `'Remote, US'` → `false`.

- [ ] **Step 2: Run the test to verify it fails**
  Run: `node scripts/test-role-filter.mjs`
  Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/lib/role-filter.mjs`**
  - Move `buildTitleFilter` verbatim from `scripts/scan.mjs` (including the ≤ 3-char word-boundary rule and its explanatory comment) into this module, and export it.
  - `buildDateWindow(days, now = new Date())`: compute `ageDays = floor((now - jobDate) / 86400000)`. A date in the future (`ageDays < 0`) is `in_window`. `ageDays > days` → `too_old`. `date == null` → `undated`, kept.
  - `buildLocationFilter`: same semantics as the current `scan.mjs` version — negatives first, then positives, empty location passes.

- [ ] **Step 4: Run the test to verify it passes**
  Run: `node scripts/test-role-filter.mjs`
  Expected: all cases PASS.

- [ ] **Step 5: Run the existing regression test to confirm nothing broke**
  Run: `node scripts/test-title-filter.mjs`
  Expected: `All cases pass`.

- [ ] **Step 6: Commit**
  ```bash
  git add scripts/lib/role-filter.mjs scripts/test-role-filter.mjs
  git commit -m "feat(scan): add role filter with 7-day posting window and strict title matching"
  ```

---

### Task 5: Daily digest writer

**Files:**
- Create: `scripts/lib/digest.mjs`
- Create: `scripts/test-digest.mjs`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  ```js
  export function buildDigest(input: {
    date: string,
    companies: Array<{ name: string, careers_url: string, status: 'ok'|'error'|'no_roles'|'skipped', error?: string, newCount: number }>,
    jobs: Job[],
    windowDays: number,
  }): string
  export function buildDigestTsv(input: { date: string, jobs: Job[] }): string
  ```

- [ ] **Step 1: Write the failing test** `scripts/test-digest.mjs` — build a digest from a fixture with 2 companies (one with 2 jobs, one with 0) and assert:
  - The output contains a header line with the date, the scanned-company count and the new-role count.
  - It contains one section per company that has ≥ 1 new job, with the company name, a link to its careers page, and one table row per job containing the title, the location, the posted date (or the literal `undated`) and a link to the job.
  - It contains an appendix table listing EVERY scanned company with its status, including the zero-result company and any error company, with the error message visible.
  - `buildDigestTsv` produces a header `date\tcompany\ttitle\tlocation\tposted\turl\tprovider` and one row per job, dated rows before undated rows, and rows sorted by company then title.

- [ ] **Step 2: Run the test to verify it fails**
  Run: `node scripts/test-digest.mjs`
  Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/lib/digest.mjs`**
  - `buildDigest` returns markdown with these sections in order: title + summary block, one `## <company>` section per company with new jobs (company name, careers link, table of roles), then `## All scanned companies` appendix table (`Company | Careers page | New roles | Status`), then a `## Errors` section listing company + error when any.
  - Jobs within a company sort newest-first; undated jobs last.
  - Posted date renders as `YYYY-MM-DD` or the literal `undated`.
  - `buildDigestTsv` returns the TSV string described above, dated rows first, then undated.

- [ ] **Step 4: Run the test to verify it passes**
  Run: `node scripts/test-digest.mjs`
  Expected: all cases PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add scripts/lib/digest.mjs scripts/test-digest.mjs
  git commit -m "feat(scan): add per-company daily digest writer"
  ```

---

### Task 6: Orchestrate it all in `scan.mjs` + daily loop

**Files:**
- Modify: `scripts/scan.mjs`
- Modify: `scripts/scan-loop.mjs`
- Modify: `package.json` (add `scan:daily` script)
- Test: `scripts/test-scan-orchestration.mjs`

**Interfaces:**
- Consumes: `detectProvider` / `fetchFromProvider` (Task 2), `extractJobsFromHtml` / `createBrowserSession` (Task 3), `buildTitleFilter` / `buildDateWindow` / `buildLocationFilter` (Task 4), `buildDigest` / `buildDigestTsv` (Task 5), `portals.yml` (Task 1).
- Produces:
  - `data/daily-scans/YYYY-MM-DD.md` — the per-company digest
  - `data/daily-scans/YYYY-MM-DD.tsv` — machine-readable rows
  - appended rows in `data/pipeline.md` (`## Pendientes`) and `data/scan-history.tsv`
  - CLI: `node scripts/scan.mjs [--dry-run] [--company <substring>] [--days N] [--date YYYY-MM-DD]`

- [ ] **Step 1: Write the failing test** `scripts/test-scan-orchestration.mjs` — the orchestration logic must be importable without side effects, so refactor `scan.mjs` to export a pure `planScan()` and keep `main()` behind a `if (import.meta.url === pathToFileURL(process.argv[1]).href)` guard. The test calls:
  ```js
  planScan({ companies, jobs, seenUrls, titleFilter, dateWindow, locationFilter })
  // → { accepted: Job[], rejected: Array<{job, reason}> }
  ```
  and asserts:
  - a job older than the window is rejected with reason `too_old`;
  - an undated job is accepted with reason `undated`;
  - a job whose title matches a negative is rejected with reason `title`;
  - a job whose URL is already in `seenUrls` is rejected with reason `dup`;
  - the same URL appearing twice in `jobs` yields exactly one accepted entry;
  - a job with a location rejected by the location filter is rejected with reason `location`;
  - acceptance order is: dated jobs newest-first, then undated jobs.

- [ ] **Step 2: Run the test to verify it fails**
  Run: `node scripts/test-scan-orchestration.mjs`
  Expected: FAIL — `planScan` not exported.

- [ ] **Step 3: Refactor `scripts/scan.mjs`**
  - Replace the inline `buildTitleFilter` / `buildLocationFilter` with imports from `scripts/lib/role-filter.mjs` (keep the old definitions removed so there is exactly one implementation).
  - Add `planScan()` as described, exported.
  - Add the `main()` guard so importing the module does not execute a scan.
  - Add `--days N` (default `7`) and `--date YYYY-MM-DD` (default: today, UTC) flags.
  - In the per-company loop:
    1. `provider = detectProvider(company.careers_url)`; if non-null → `fetchFromProvider`; on error → fall through to HTML and record the provider error.
    2. If no provider, or the provider returned 0 jobs, or the provider fetch threw → `extractJobsFromHtml(await fetchHtml(careers_url), company.name, careers_url)`.
    3. If the HTML path yields 0 jobs → use the shared browser session (`createBrowserSession()`) to render the page and extract again. Record `status: 'error'` only if the browser also failed; otherwise `status: 'no_roles'`.
    4. Apply `planScan` to the company's jobs: title filter → location filter → date window → URL dedup (global `seenUrls` + `seenCompanyRoles` from `applications.md`).
    5. Record the company's summary row for the digest.
  - Concurrency: API calls stay at the current `CONCURRENCY = 10`. Browser rendering MUST be sequential (one browser, one page at a time) — Playwright is not safe to parallelize here and 155 pages would thrash the machine.
  - Write outputs: `data/daily-scans/<date>.md`, `data/daily-scans/<date>.tsv`, append accepted jobs to `data/pipeline.md` under `## Pendientes`, append ALL seen URLs to `data/scan-history.tsv` with status `added` / `skipped_title` / `skipped_old` / `skipped_dup` / `skipped_location`.
  - `--dry-run` must write nothing but must still print the summary and the per-company counts.
  - Print a summary block: companies scanned, companies with errors, total roles seen, roles passing title filter, roles outside the window, new roles added, and the path to the digest.

- [ ] **Step 4: Run the test to verify it passes**
  Run: `node scripts/test-scan-orchestration.mjs`
  Expected: all cases PASS.

- [ ] **Step 5: Update `scripts/scan-loop.mjs` for a daily cadence**
  - Add `--interval-hours N` (default keep `180` minutes behaviour) and a `--daily` flag that runs once then sleeps until the next 06:00 Europe/Berlin local time.
  - `runScan()` must pass through the new flags.
  - Do not change the existing `--once` / `--interval-minutes=` behaviour — other tooling may use it.

- [ ] **Step 6: Add the npm script**
  In `package.json` add: `"scan:daily": "node scripts/scan-loop.mjs --daily"`.

- [ ] **Step 7: Run a real dry run**
  Run: `node scripts/scan.mjs --dry-run --days 7`
  Expected: a summary block with `Companies scanned: 280` (or close), zero uncaught exceptions, and per-company status counts. Errors limited to bot-walled boards, each reported as a company error rather than a crash.

- [ ] **Step 8: Run a real scan into a scratch date**
  Run: `node scripts/scan.mjs --date 2026-10-20`
  Expected: `data/daily-scans/2026-10-20.md` and `.tsv` exist, `data/pipeline.md` gained rows under `## Pendientes`, `data/scan-history.tsv` gained rows, and the digest's appendix lists every scanned company.

- [ ] **Step 9: Verify the digest content**
  Run: `node scripts/verify-pipeline.mjs` then open `data/daily-scans/2026-10-20.md`.
  Expected: the verify script still passes; the digest shows the AI/Python/Software/ML roles and contains no logistics or marketing roles.

- [ ] **Step 10: Commit**
  ```bash
  git add scripts/scan.mjs scripts/scan-loop.mjs scripts/test-scan-orchestration.mjs package.json
  git commit -m "feat(scan): orchestrate ATS + HTML + Playwright with daily per-company digest"
  ```

---

### Task 7: Document the workflow

**Files:**
- Modify: `modes/scan.md` (add the daily-digest workflow section)
- Modify: `AGENTS.md` (add the daily scan command to the pipeline section)
- Modify: `DIR_INDEX.md` (add `scripts/lib/` and `data/daily-scans/`)

- [ ] **Step 1: Write the `modes/scan.md` section**
  Add a `## Daily Berlin AI + Retail scan` section describing: the command (`node scripts/scan.mjs`), the 7-day window and undated policy, the strict title policy, the per-company digest path, and the fact that a `403 gated` board still works in a browser.

- [ ] **Step 2: Update `AGENTS.md`**
  In the pipeline-integrity area, add one line: `node scripts/scan.mjs` runs the daily career-page scan and writes `data/daily-scans/<date>.md`; run it before `/career-ops pipeline` to refresh pending offers.

- [ ] **Step 3: Update `DIR_INDEX.md`**
  Add rows for `scripts/lib/` (ATS adapters, HTML extraction, role filter, digest writer) and `data/daily-scans/` (per-day digests, gitignored).

- [ ] **Step 4: Verify the docs render and commit**
  ```bash
  git add modes/scan.md AGENTS.md DIR_INDEX.md
  git commit -m "docs: document the daily career-page scan workflow"
  ```

---

## Self-Review

**Spec coverage** — the user's four decisions map to: 7-day window + undated kept → Task 4 (`buildDateWindow`) and Task 6 (digest renders `undated`); daily digest + pipeline.md → Task 5 + Task 6; strict title matching → Task 1 (positives/negatives) + Task 4; hybrid HTTP-then-Playwright → Task 3 + Task 6 step 3. "For each career page and company" → Task 5's `## All scanned companies` appendix and Task 6's per-company status row. Wiring `portals.yml` → Task 1.

**Step scan** — every step names one file, one function signature or one exact command, and the exact expected output. No step says "handle errors" without naming the behaviour.

**Type consistency** — `Job` is `{ title, url, company, location, date, provider }` in Task 2 and reused unchanged in Tasks 3, 4, 5, 6. `Provider` is `{ type, url, slug, host }`. `planScan` returns `{ accepted, rejected }` with `rejected` entries of `{ job, reason }` where `reason ∈ 'title'|'location'|'too_old'|'dup'`. `buildDigest`'s `companies[]` entries use `status ∈ 'ok'|'error'|'no_roles'|'skipped'`.

**Review Focus coverage** — (1) zero-link board → Task 3 test B + Task 6 step 3 status `no_roles`; (2) substring false positives → Task 4 title cases `Team Lead, Paid Search` / `Storage Engineer` / `HTML Developer`; (3) undated kept → Task 4 date case `date null`; (4) 403 must not abort → Task 6 step 3 (per-company try/catch) and the `errors` section of Task 5's digest; (5) duplicate URLs → Task 6 `planScan` `dup` case and the intra-run dedup case; (6) German titles → Task 4 title case `Entwickler (m/w/d) Python` and Task 3 fixture D.

**Proportion** — the plan is ~7 tasks for ~1500 lines of new code across 8 files. Each task is independently testable and each test is a table, not a transcript.
