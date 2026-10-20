# SDD ledger — plan: integrations/linkedin-scan/SPEC.md

Phase 0a of the LinkedIn scanner spec: selector registry + parse, offline, TDD.

Pre-flight: shared interfaces between Phase 0a files — `lib/parse.mjs` (pure text
helpers) is consumed by `lib/selectors.mjs` (DOM resolvers); `lib/selectors.mjs` is
consumed by the test harness via an injected browser source. No conflict.

Ruling: work in place on branch `german-reform`, no git worktree — the repo carries a
large amount of uncommitted work (config, modes, scripts) and a worktree cut from HEAD
would not contain it, so the implementation would not sit on the same base as the spec
was written against. Cost if wrong: a messy branch history, no functional risk.

Ruling: card discovery uses `[componentkey^="job-card-component-ref-"]`, not
`a[href*="/jobs/view/"]` as SPEC §6.2 assumed. The live 2026-10-20 DOM contains **no
anchors at all** inside job cards (the card is a `div[role=button]`); the only
`/jobs/view/` link on the page belongs to the detail pane. `componentkey` is a stable
non-class attribute and carries the job id. Cost if wrong: none — it is stronger than
the assumed hook, and the atomic-renamed fixture test still guards the class-based
paths that do exist.

Ruling: the fixture is a sanitized two-pane snapshot (results list + selected job's
detail pane) rather than a whole-page HTML dump. Whole-page capture pulls in the nav
bar with the account holder's name and e-mail; the two panes are everything the
resolvers read. Cost if wrong: a resolver that needs page-level context (e.g. reading
the "83 results" counter) would have no fixture to read it from.

Ruling: selector tests run the resolver source inside a real Chromium page loaded from
a `file://` fixture, instead of adding a DOM library (jsdom/linkedom) as a dependency.
Playwright is already a dependency, the resolver must run in a browser at runtime
anyway, and the suite stays offline. Cost if wrong: ~1 s per test file for browser
start-up.

## Task 1 — fixture capture (DONE)

- Captured the live search-results page: 25 cards, JD present.
- `integrations/linkedin-scan/fixtures/search-results.html` (105 kB, sanitized).
- `integrations/linkedin-scan/fixtures/search-results.atomic-renamed.html` (i0*/js0*
  class tokens renamed to `renamed<n>`).
- Tools: `tools/capture-fixture.mjs`, `tools/wait-auth.mjs`, `tools/open-login.mjs`.

## Task 2 — `lib/parse.mjs` (DONE)

TDD: 34 tests written first, watched fail (module not found), then implemented.
Rules: posted age (EN + DE), location → city/country/work mode, company span with the
legal-form fold, title cleaning (status marker + gender tag + double rendering), job
id, canonical URL, badge/note vocabulary, salary.

Ruling: `country` is only set when the location text **names** a country. A bare
"Munich (Hybrid)" yields `country = null`; the search geography (geoId) supplies the
default, and the location gate only skips on an explicit non-German country. Cost if
wrong: a card that quietly left Germany would need the geo check rather than the text.

Ruling: `Easy Apply` is its own field, not a badge. The record keeps `easy_apply: true`
and `badges: ['Be an early applicant', 'Promoted']`. Cost if wrong: one field rename.

## Task 3 — `lib/selectors.mjs` + `lib/inject.mjs` + `lib/atomic.mjs` (DONE)

TDD: 12 fixture tests written first (module not found), then implemented against the
real DOM. 46/46 green (`npm run linkedin:test`, ~1.5 s, no network).

Ruling: text extraction uses a **structure-based line walker** (`textLines()`), not
`innerText`. `innerText` breaks lines at stylesheet-driven line boxes, so the same
markup yields different lines depending on the CSS that happens to be loaded — the
sanitized fixture has no stylesheet, the live page has one. Cost if wrong: none; the
walker is strictly more predictable.

Ruling: the title is de-duplicated in the parser, not in the DOM layer. LinkedIn
renders the title twice (once for assistive technology, once for sighted users) and
the two copies land on one line or two depending on the layout, so both shapes are
handled in `cleanTitle()`. Cost if wrong: a title that legitimately repeats ("AI AI")
would be halved.

Ruling: the description is read from the **section around the "About the job"
heading**, not from `[data-testid="expandable-text-box"]`. LinkedIn ships invalid
nesting (`<p><span><p>…</p></span></p>`); the browser repairs it, which leaves the text
box empty and the description paragraphs as its siblings. Cost if wrong: the JD would
be empty for every job.

## Task 4 — spec reconciliation (DONE)

SPEC.md §6 rewritten against the live DOM: new §6.2.1 records the five findings,
§6.2 tiers gained the `componentkey` and ARIA rows, §6.3 discovery now hangs off
`componentkey`, §6.4 documents the implemented field rules, §6.5 documents the
description rule, §6.7 the mutation test, §11.1/§15.1/§15.2/§16 the real files and
test matrix.

## Verification

- `npm run linkedin:test` → 46 pass, 0 fail.
- `npm run doctor` → all checks pass.
- `npm run verify` → **48 pre-existing errors** ("Report not found: reports/0NN-*.md"):
  the tracker references 48 report files that are no longer on disk. `reports/` and
  `data/` are gitignored and were not touched by this phase.

## Task 5 — code review (DONE)

A fresh reviewer read the commit against the spec and the hard constraints. It found
**four Critical and seven Important** problems. All four Criticals and the Importants
were reproduced locally before any fix, then fixed test-first.

### Critical — fixed

| # | Finding | Fix |
|---|---|---|
| C-1 | **The posting age was never parsed: 0 of 25 cards.** LinkedIn renders the age twice inside one paragraph, so the line is `"Posted 5 hours ago5 hours ago"`; the age regexes were end-anchored. | The age is matched without an end anchor and the raw value is the matched substring. German `vor 3 Minuten` / `vor 1 Stunde` added. |
| C-2 | **The mutation test did not cover the detail pane** — a class dependency in the detail path passed 46/46. | The stable detail record is compared as a whole. Verified with a negative control: injecting `.js0ga0` into the detail resolver now fails the test. |
| C-3 | **A card with no company line was reported as `"GmbH"`.** The legal-form fold only merged into a *previous* line. | A company span that is nothing but a legal form reports **no company**. |
| C-4 | **An unknown location became part of the company** (`"Acme Tallinn, Estonia"`, `"Acme Berlin (Homeoffice)"`, `"Acme Remote (UK)"`). | The location is taken from its **position** (the last line before the meta), not from a vocabulary. The vocabulary now only classifies the location, and knows the German work modes and the country codes. |

### Important — fixed

- **I-1** `textLines()` never skipped `<svg>` (SVG elements keep a lower-case `tagName` in an HTML document), so an icon's accessible name could become the card title. The tag name is now normalised; a test with an inline `<svg><title>` pins it.
- **I-2** `inject.mjs` would have produced an unparseable script the moment a module used `export default`. It now refuses leftover module syntax, duplicate top-level names and source that does not parse — all three are tested.
- **I-3** `extraction.tiers` was a hard-coded literal, so the "no atomic class" assertion could never fail. The tiers now name the strategy that actually ran and the test asserts the expected values.
- **I-4** Without an "About the job" heading, `extractDetail` returned **the whole page** as the job description — and the 200-character sanity gate then passed. It now returns an empty description flagged `jd_incomplete`.
- **I-5** The detail record's posting time was read from the **results list**, so it belonged to a different job. It is now read from the pane header (the lines before the description).
- **I-6** The detail extraction now returns `jd_incomplete` / `degraded` flags and an identity check.
- **I-7** The capture had no personal-data guard, and the committed fixture already carried the global footer and `n_nav` tracking ids. The capture now refuses a `<body>` root, strips every profile link, collects the account holder's name and e-mail from the live page, and **writes nothing** if anything personal survives (exit 5). The list root is now the smallest ancestor that contains all cards, which keeps the page chrome out.

### Also fixed after the re-capture

- The capture now strips the **page chrome** the search pane drags in (the global footer
  links, the job-alert promo, `n_nav`/`trk=` tracking ids). The committed fixture
  carried them before.
- Two tests that pinned a **volatile** value (an exact posting age, an exact detail-pane
  time) were rewritten to assert the *shape* instead, because a live capture ages between
  runs. The golden file never pinned them either.

### Minor — fixed

M-1 short doubled titles · M-2 German minute/hour units · M-3 legacy `-` separator ·
M-4 dead code in `cleanTitle` · M-5 legal-form duplicates and over-broad tokens ·
M-6 badge matching is now pattern-based (`55 applicants`, `1 connection works here`) ·
M-7 the renamer handles single-quoted and unquoted `class` attributes ·
M-8 the test page aborts every non-`file://` request ·
M-10 the session state is written next to the repo, not next to the cwd.

M-9 (the ledger was untracked) is fixed by committing it as
`integrations/linkedin-scan/notes/phase-0a-ledger.md`.

### Negative controls (the guardrail proven)

| Injected dependency | Before the fix | After the fix |
|---|---|---|
| `.js0ga0` in the detail title resolver | suite stayed green | **mutation test fails** |
| `.js0k4p` in the card resolver | suite stayed green | **mutation test + golden test fail** |

## Verification

- `npm run linkedin:test` → **79 pass, 0 fail** (parse 51, selectors 19, guards 9).
- `npm run doctor` → all checks pass.
- `npm run verify` → **48 pre-existing errors** ("Report not found: reports/0NN-*.md"):
  the tracker references 48 report files that are no longer on disk. `reports/` and
  `data/` are gitignored and were not touched by this phase.



## Final review

- One fresh reviewer read the Phase 0a commit against the spec and the hard constraints.
- All four Critical and all seven Important findings were reproduced, fixed test-first,
  and are listed above. Nine of the ten Minors were fixed; none were deferred to a
  later phase except the ledger-tracking one, which this file resolves.
- Negative controls: an injected obfuscated class in the card path and in the detail
  path both make the mutation test fail, so the "no brittle classes" rule is enforced
  by a test that can actually fail.
- The work is committed on the branch `german-reform` (18d5e67, ae64bb9). No merge and
  no push: the repository carries a large amount of unrelated uncommitted work, so
  integrating this is a decision for the owner.
