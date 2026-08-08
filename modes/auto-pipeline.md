# Mode: auto-pipeline — Complete Automatic Pipeline

When the user pastes a JD (text or URL) without an explicit sub-command, execute the ENTIRE pipeline in sequence:

## Step 0 — Extract JD

If the input is a **URL** (not pasted JD text), follow this strategy to extract the content:

**Priority order:**

1. **Playwright (preferred):** Most job portals (Lever, Ashby, Greenhouse, Workday) are SPAs. Use `browser_navigate` + `browser_snapshot` to render and read the JD.
2. **WebFetch (fallback):** For static pages (ZipRecruiter, WeLoveProduct, company career pages).
3. **WebSearch (last resort):** Search role title + company on secondary portals that index the JD in static HTML.

**If no method works:** Ask the candidate to paste the JD manually or share a screenshot.

**If the input is JD text** (not a URL): use directly, no fetch needed.

## Step 1 — A-G Evaluation

Execute exactly like the `oferta` mode (read `modes/oferta.md` for all blocks A-F + Block G Posting Legitimacy).

## Step 2 — Save Report .md

Save the complete evaluation to `reports/{###}-{company-slug}-{YYYY-MM-DD}.md` (see format in `modes/oferta.md`).
Include Block G in the saved report. Add `**Legitimacy:** {tier}` to the report header.

## Step 3 — Generate PDF

Execute the complete `pdf` pipeline (read `modes/pdf.md`).

## Step 4 — Draft Application Answers (only if score >= 4.5)

If the final score is >= 4.5, generate draft answers for the application form:

1. **Extract form questions**: Use Playwright to navigate to the form and snapshot. If they can't be extracted, use generic questions.
2. **Generate answers** following the tone (see below).
3. **Save in the report** as section `## H) Draft Application Answers`.

### Generic Questions (use if form questions can't be extracted)

- Why are you interested in this role?
- Why do you want to work at [Company]?
- Tell us about a relevant project or achievement
- What makes you a good fit for this position?
- How did you hear about this role?

### Tone for Form Answers

**Position: "I'm choosing you."** the candidate has options and is choosing this company for concrete reasons.

**Tone rules:**
- **Confident without arrogance**: "I've spent the past year building production AI agent systems — your role is where I want to apply that experience next"
- **Selective without conceit**: "I've been intentional about finding a team where I can contribute meaningfully from day one"
- **Specific and concrete**: Always reference something REAL from the JD or company, and something REAL from the candidate's experience
- **Direct, no fluff**: 2-4 sentences per answer. No "I'm passionate about..." or "I would love the opportunity to..."
- **The hook is the proof, not the claim**: Instead of "I'm great at X", say "I built X that does Y"

**Framework per question:**
- **Why this role?** → "Your [specific thing] maps directly to [specific thing I built]."
- **Why this company?** → Mention something concrete about the company. "I've been using [product] for [time/purpose]."
- **Relevant experience?** → A quantified proof point. "Built [X] that [metric]. Sold the company in 2025."
- **Good fit?** → "I sit at the intersection of [A] and [B], which is exactly where this role lives."
- **How did you hear?** → Honest: "Found through [portal/scan], evaluated against my criteria, and it scored highest."

**Language**: Always in the JD language (EN default). Apply `/tech-translate`.

## Step 5 — Update Tracker

**Never write directly into `data/applications.md`.** The data contract (`docs/DATA_CONTRACT.md` + `modes/_shared.md` rule 9) requires routing additions through the TSV merge path:

1. **Write the addition as a TSV row** in `batch/tracker-additions/{###}-{company-slug}-{YYYY-MM-DD}.tsv`.
2. **TSV column order** (9 cols, tab-separated): `num \t date \t company \t role \t status \t score \t pdf \t report \t notes`.
   - `num` = next `#` from the tracker, `date` = today (`YYYY-MM-DD`), `company` = company name, `role` = role title.
   - `status` = one canonical value: `Evaluated`, `Applied`, `Responded`, `Interview`, `Offer`, `Rejected`, `Discarded`, `SKIP`. No markdown bold, no dates inside the status — dates go in the `date` column.
   - `score` = `X.XX/5` (or `N/A` / `DUP`), `pdf` = link to the generated PDF, `report` = link to the saved report `.md`.
3. **Merge:** run `node scripts/merge-tracker.mjs` (add `--verify` to also validate the merged result). The script dedups (company + fuzzy role + report number), updates in place when a duplicate has a higher score, and archives merged TSVs into `batch/tracker-additions/merged/`.
4. **Sanity checks:** `node scripts/dedup-tracker.mjs`, `node scripts/normalize-statuses.mjs`, then `node scripts/verify-pipeline.mjs` to confirm a clean pipeline (all statuses canonical, no duplicates, valid report links).

**If any step fails**, continue with the following and mark the failed step as pending in the tracker (TSV row with `status=Evaluated` and the missing artifact left empty or `pending` in its column).
