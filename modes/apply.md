# Mode: apply — Live Application Assistant

Interactive mode for when the candidate is filling out an application form in Chrome. Reads what's on screen, loads the job context, and generates personalized answers for each form question.

## Requirements

- **Best with Playwright visible**: In visible mode, the candidate sees the browser and Claude can interact with the page.
- **Without Playwright**: the candidate shares a screenshot or pastes the questions manually.

## Workflow

```
1. DETECT    → Read active Chrome tab (screenshot/URL/title)
2. IDENTIFY  → Extract company + role from the page
3. LOOK UP   → Match against existing reports in reports/
4. LOAD      → Read full report + Section G draft answers
5. COMPARE   → Has the role changed? Alert if so
6. ANALYZE   → Identify ALL form questions visible
7. GENERATE  → Personalized answer for each question
8. PRESENT   → Formatted answers ready to copy-paste
```

## Step 0 — Open the Apply Link in Chrome

Before reading the form, open the job's apply URL(s) in Chrome so they are ready to fill out:

1. Get the apply URL(s) of the ranked/selected job(s) from the evaluation report or tracker.
2. Open them in Chrome, each in its own tab:
   - **With Playwright (visible mode):** `python3 scripts/open_all_jobs.py <url1> <url2> ...`
   - **Or with the system browser:** `xdg-open <url>` (repeat per URL)
3. Confirm the tab(s) loaded and the application form is visible before proceeding.

## Step 1 — Detect the Job

**With Playwright:** Take snapshot of the active page. Read title, URL, and visible content.

**Without Playwright:** Ask the candidate to:
- Share a screenshot of the form (Read tool reads images)
- Or paste the form questions as text
- Or name company + role so we can search for it

## Step 2 — Identify and Look Up Context

1. Extract company name and job title from the page
2. Search `reports/` by company name (case-insensitive grep)
3. If there's a match → load the full report
4. If Section G exists → load the previous draft answers as a base
5. If NO match → alert and offer to run a quick auto-pipeline

## Step 3 — Detect Role Changes

If the role on screen differs from the evaluated one:
- **Alert the candidate**: "The role has changed from [X] to [Y]. Do you want me to re-evaluate or adapt the answers to the new title?"
- **If adapting**: Adjust the answers to the new role without re-evaluating
- **If re-evaluating**: Run full A-F evaluation, update report, regenerate Section G
- **Update tracker**: Change role title in applications.md if applicable

## Step 4 — Analyze Form Questions

Identify ALL visible questions:
- Free text fields (cover letter, why this role, etc.)
- Dropdowns (how did you hear, work authorization, etc.)
- Yes/No (relocation, visa, etc.)
- Salary fields (range, expectation)
- Upload fields (resume, cover letter PDF)

Classify each question:
- **Already answered in Section G** → adapt the existing answer
- **New question** → generate answer from report + cv.md

## Step 5 — Generate Answers

For each question, generate the answer following:

1. **Report context**: Use proof points from block B, STAR stories from block F
2. **Previous Section G**: If a draft answer exists, use it as a base and refine
3. **"I'm choosing you" tone**: Same framework as auto-pipeline
4. **Specificity**: Reference something concrete from the JD visible on screen
5. **career-ops proof point**: Include in "Additional info" if there's a field for it

**Output format:**

```
## Answers for [Company] — [Role]

Based on: Report #NNN | Score: X.X/5 | Archetype: [type]

---

### 1. [Exact question from the form]
> [Answer ready to copy-paste]

### 2. [Next question]
> [Answer]

...

---

Notes:
- [Any observations about the role, changes, etc.]
- [Customization suggestions the candidate should review]
```

## Step 6 — Post-apply (optional)

If the candidate confirms they submitted the application:
1. Update status in `applications.md` from "Evaluated" to "Applied"
2. Update Section G of the report with the final answers
3. Suggest next step: `/career-ops contacto` for LinkedIn outreach

## Scroll Handling

If the form has more questions than visible:
- Ask the candidate to scroll and share another screenshot
- Or paste the remaining questions
- Process in iterations until everything is covered
