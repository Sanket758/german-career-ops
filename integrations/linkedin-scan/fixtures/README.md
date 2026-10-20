# LinkedIn scanner fixtures

Committed DOM snapshots used by the offline test suite. They are captured from a
logged-in session of the account owner and **sanitized** before they are written.

| File | What it is |
|---|---|
| `search-results.html` | The results list (25 cards) plus the selected job's detail pane, captured 2026-10-20 from the "AI/ML Berlin, last 24 h" search |
| `search-results.atomic-renamed.html` | The same file with every obfuscated class (`i0…`, `js0…`) renamed to `renamed<n>` |

## What the sanitizer removes

Only two subtrees are kept — the results list and the detail pane — because those are
all the resolvers read. Everything else (the nav bar with the account holder's name and
e-mail, scripts, stylesheets, images, SVG, buttons, inline styles) never enters the
file. The result is a fixture with no personal data in it at all.

## How to refresh

```bash
# 1. Start the automation Chrome and log in (see SPEC.md §4.4)
bash scripts/launch-career-ops-chrome.sh
node integrations/linkedin-scan/tools/open-login.mjs

# 2. Capture (writes both files)
npm run linkedin:fixtures

# 3. Regenerate the golden records and review the diff
npm run linkedin:golden
npm run linkedin:test
```

A capture is **not** reproducible byte-for-byte: the result set changes with the
market, the relative posting times age, and LinkedIn rotates its class names. The
golden file therefore pins only the stable fields (id, title, company, location,
badges, salary) and never the relative age.

## The mutation test

`search-results.atomic-renamed.html` is the guardrail against the rule that started
this integration: no extraction path may depend on a generated class. The renamer and
the class pattern live in `lib/atomic.mjs`; the test asserts that both files produce
byte-identical extracted records, and that the mutation is real (the original contains
hundreds of obfuscated tokens, the renamed one contains none).
