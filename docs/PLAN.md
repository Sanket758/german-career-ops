# Career-Ops Germany Blueprint

## Summary

Build a Germany-first fork of `career-ops` that keeps the original orchestration quality but changes the default market model from US/global-generic to German-market-specific.

This fork is for a Berlin-based AI/ML candidate with:
- AI/ML + Computer Vision + Robotics target roles
- `Werkstudent` and selective full-time roles
- English C1, German around A2 and improving
- student visa / work authorization constraints
- preference for Berlin or remote-within-Germany opportunities

The fork must feel like `career-ops`, not like a translation patch.

## Core Product Decisions

1. **Germany is the default market**
   The base `modes/` should already encode German-market assumptions.

2. **English roles in Germany are still in scope**
   Germany-first does not mean German-only. English JDs from German companies still need German-market evaluation logic.

3. **Visa, language, and location are first-class scoring inputs**
   They are not side notes.

4. **Documents must match German expectations**
   CV, `Anschreiben`, attachments, salary framing, and tone need Germany-specific defaults.

5. **Keep the same orchestration surface**
   Reuse the same mode-driven routing, pipeline flow, tracker discipline, and batch architecture as `career-ops`.

## Planned Repository Layout

```text
career-ops-germany/
  CLAUDE.md
  AGENTS.md
  PLAN.md
  DATA_CONTRACT.md
  README.md
  cv.md
  article-digest.md
  portals.yml
  config/
    profile.yml
    profile.example.yml
  modes/
    _shared.md
    _profile.md
    _profile.template.md
    auto-pipeline.md
    oferta.md
    ofertas.md
    contacto.md
    deep.md
    pdf.md
    apply.md
    pipeline.md
    scan.md
    research.md
    vocab.md
    tracker.md
    training.md
    project.md
    patterns.md
    followup.md
    interview-prep.md
  data/
    applications.md
    pipeline.md
    scan-history.tsv
    burn-list.tsv
    vocab-history.tsv
    follow-ups.md
  reports/
    intel-*/
  output/
  jds/
  batch/
    tracker-additions/
    logs/
  templates/
    cv-template.html
    cover-letter-template.html
    portals.example.yml
    states.yml
  docs/
    CODEX.md
```

## Command Surface

Keep the same command names as upstream so the workflow stays familiar:

| Command | Purpose |
| ------- | ------- |
| `/career-ops` | router and menu |
| `/career-ops pipeline` | process inbox |
| `/career-ops oferta` | single-role evaluation |
| `/career-ops ofertas` | compare roles |
| `/career-ops contacto` | outreach |
| `/career-ops deep` | company research |
| `/career-ops pdf` | CV / cover letter generation |
| `/career-ops apply` | live application assistant |
| `/career-ops scan` | German-market scan |
| `/career-ops research` | generate company intelligence brief |
| `/career-ops vocab` | extract German vocab & generate flashcards |
| `/career-ops tracker` | status overview |
| `/career-ops training` | course/cert evaluation |
| `/career-ops project` | project evaluation |
| `/career-ops patterns` | targeting analysis |
| `/career-ops followup` | follow-up cadence |
| `/career-ops interview-prep` | interview prep |

## German-Market Deltas vs Upstream

### 1. Search / Scan

Change the scan defaults from generic portal-first to Germany-aware discovery:

- prioritize Germany-based company career pages
- use ATS APIs where available
- include LinkedIn Germany public pages
- include German-market job boards where they are useful
- dedup aggressively because the same role appears across StepStone, LinkedIn, Xing, and company pages
- treat stale aggregator listings as a major risk

Target sources for `portals.yml`:
- LinkedIn Germany
- StepStone
- XING / onlyfy
- company career pages
- Greenhouse
- Lever
- Ashby
- Workday
- SmartRecruiters
- Personio
- BambooHR

### 2. Evaluation

The evaluation system must incorporate these German-market dimensions:

- German language requirement
- work authorization / visa fit
- Berlin vs. outside-Berlin location realism
- `Werkstudent` vs. full-time vs. internship fit
- compensation in EUR, including 13th salary and common German benefits
- company type (startup, Mittelstand, enterprise, public sector)
- attachment expectations (`Anschreiben`, `Zeugnisse`, transcripts)

### 3. Documents

PDF generation must support:
- English CV for English JDs in Germany
- German CV for German-language roles
- concise Germany-appropriate `Anschreiben`
- calmer tone than US-style cover letters
- explicit handling of location, visa, and earliest start when useful

Hard rule:
- do not add photo, DOB, nationality, or other sensitive fields unless explicitly requested

### 4. Compensation Intelligence

Use German-market logic:
- hourly rates for `Werkstudent`
- annual gross salary for full-time
- `13. Monatsgehalt` / Christmas pay
- bonus
- bAV
- VWL
- travel or meal subsidy
- tariff-based pay where relevant

### 5. Interview and Application Fit

The fork should explicitly handle:
- visa clarification
- German level explanation without overselling
- Berlin location availability
- why Germany / why Berlin
- transition from student to full-time after graduation

## Mode Responsibilities

| Mode | Germany-first responsibility |
| ---- | ---------------------------- |
| `auto-pipeline` | fetch JD, verify freshness, evaluate, save report, generate PDFs, register tracker row |
| `oferta` | score one role with German-market fit logic |
| `ofertas` | compare multiple Germany-based roles |
| `scan` | search German portals and company pages |
| `pdf` | choose CV variant and generate `Anschreiben` |
| `apply` | fill forms with visa / language / salary realism |
| `pipeline` | process saved Germany-based URLs |
| `deep` | research company, market position, and compensation signals in Germany |
| `contacto` | recruiter or hiring-team outreach with German-market tone |
| `research` | generate company intelligence briefs and find key employees |
| `vocab` | extract German vocabulary from JDs for Anki flashcards |
| `tracker` | application status and bottleneck analysis |
| `training` | evaluate certifications against German-market ROI |
| `project` | evaluate project ideas for German-market signaling |
| `patterns` | spot low-fit application patterns |
| `followup` | follow-up timing adapted to German-market cadence |
| `interview-prep` | German-market interview prep and objection handling |

## Scan Architecture

The scan flow should mirror upstream quality but use German-market priorities:

### Level 1 -- Company Career Pages (PRIMARY)

For tracked companies with `careers_url`:
- open with Playwright
- read all visible listings
- extract title, URL, location, language hints, and whether the role is `Werkstudent`, internship, or full-time

### Level 2 -- ATS APIs / Feeds (COMPLEMENTARY)

Use structured feeds when available:
- Greenhouse
- Lever
- Ashby
- BambooHR
- Teamtailor
- Workday
- Personio if a parseable public feed exists

### Level 3 -- German Aggregators / Public Search (BROAD DISCOVERY)

Use broader search for discovery:
- LinkedIn Germany public results
- StepStone
- XING / onlyfy
- search-engine results for company + role

These results must be verified before they enter the pipeline.

### Priority Alerts

The scan system must implement priority tiers:

| Tier | Description | Alert Behavior |
| ---- | ----------- | -------------- |
| **TIER 1 (Urgent)** | Fraunhofer CV Werkstudent roles in Berlin | Immediate notification + auto-draft application |
| **TIER 2 (High)** | Small Berlin startups (10-50 people), English-friendly | Daily digest |
| **TIER 3 (Medium)** | Werkstudent at international companies in Germany | Weekly digest |
| **TIER 4 (Low)** | Remote Germany roles requiring C1 German | No alert unless explicitly requested |

**Fraunhofer Rule:** Any new Fraunhofer role matching "Computer Vision," "ROS2," "Werkstudent," or "Machine Learning" in Berlin must trigger an immediate alert with:
- Full job description
- Pre-filled `Anschreiben` draft
- 1-page `Lebenslauf` PDF
- Recommendation to apply within 24 hours

### Dedup Rules

Deduplicate against:
- `data/scan-history.tsv`
- `data/applications.md`
- `data/pipeline.md`
- `data/burn-list.tsv` (flag but don't silently dedup — warn the user)

### Freshness Rules

Before adding Level 3 discoveries to the pipeline:
- open the actual job page
- verify it is still active
- reject stale listing pages, redirects, expired posts, and empty shells
- reject roles posted >90 days ago (flag as stale)

## Scoring Model Changes

Keep the A-F plus legitimacy structure, but change the semantics:

| Dimension | What it measures in this fork |
| --------- | ----------------------------- |
| Match with CV | actual fit to technical requirements |
| North Star alignment | fit to target German-market roles |
| Comp | EUR compensation vs Berlin/Germany market |
| Cultural / Market signals | company quality, language environment, process, flexibility |
| Red flags | visa mismatch, language mismatch, unrealistic on-site demand, stale role, low comp |
| Global | weighted average of the above |

### German-specific penalties / boosts

- `Werkstudent` role aligned with profile -> boost
- English-friendly company -> boost
- C1 German required when user is A2 -> penalty
- Hybrid Berlin -> boost
- full-time immediate start with visa mismatch -> penalty
- fully remote within Germany -> boost
- fully on-site outside Berlin during MSc -> major penalty

## PDFs and Templates

Build templates that support:
- Strict 1-page German `Lebenslauf` format (clean, scannable, targeted)
- Concise, non-generic Cover Letters (Hook + Factual Experience + Fit)
- ATS-safe output

The project should choose the best resume variant based on:
- JD language
- role type
- depth of technical detail needed
- whether the company likely expects a German-style packet
- *Crucially*: Avoid US-style hype, marketing verbs, or dense metric-heavy blocks.

## Tracker Flow

Keep the same tracker discipline as upstream:

- never add new tracker rows directly once the TSV merge flow exists
- write one TSV addition per evaluation
- merge with `merge-tracker.mjs`
- keep canonical states

Tracker states stay:
- `Evaluated`
- `Applied`
- `Responded`
- `Interview`
- `Offer`
- `Rejected`
- `Discarded`
- `SKIP`

### Company Burn List

When a company rejects an application, the system must:

1. Add the company to `data/burn-list.tsv` with:
   - Company name
   - Date of rejection
   - Role applied to
   - Reason for rejection (if known)
   - Earliest reapply date (default: +6 months)

2. During scan or evaluation, if a new role from a burn-list company appears:
   - Flag it prominently
   - Show previous rejection date
   - Ask: "This company rejected you on [date] for [role]. Are you sure you want to apply again?"
   - Recommend waiting until the reapply window opens

**Exception:** If the new role is in a completely different department or team, downgrade the warning to "cautionary" instead of "block."

**Lesson from data:** Black Forest Labs rejected 3 separate applications. The system should have stopped after rejection #1.

## Intelligence & Targeting Workflows

These workflows replace the upstream batch automation. They automate **the right things**: discovery, research, and language learning.

### `/career-ops research` — Company Intelligence Brief

When the user runs `/career-ops research [company]`, the system must:

1. **Scrape the company's "About" and "Team" pages**
   - Extract: industry, size, funding stage, tech stack mentioned
   - Identify: English vs German language on site

2. **LinkedIn Employee Discovery**
   - Search: `[Company Name] Computer Vision site:linkedin.com`
   - Search: `[Company Name] Machine Learning site:linkedin.com`
   - Search: `[Company Name] Robotics site:linkedin.com`
   - Extract: 5-10 employee names + titles + LinkedIn URLs

3. **Generate Outreach Template**
   - For each key employee, draft a personalized LinkedIn message:
     ```
     Hi [Name],

     I'm currently completing my MSc in AI at BSBI Berlin, with my thesis
     focused on deep learning-based SKU recognition for German retail shelf
     monitoring. I noticed you work on [specific area from their profile]
     at [Company].

     I'd love to learn more about how [Company] approaches [relevant topic].
     Would you be open to a brief call? I'm also looking for Werkstudent
     opportunities where I could apply my computer vision background.

     Thanks,
     Sanket
     ```

4. **Save Intelligence Brief**
   - Save to `reports/intel-[company-slug]-[date].md`
   - Include: company summary, tech stack, key employees, outreach templates

### `/career-ops vocab` — German Technical Vocabulary Flashcards

When the user runs `/career-ops vocab [job-description-text-or-url]`, the system must:

1. **Extract German Technical Terms**
   - Identify all German words and phrases in the JD
   - Categorize by domain:
     - Technical verbs (entwickeln, implementieren, optimieren)
     - Nouns (Bildverarbeitung, Maschinelles Lernen, Regelung)
     - Adjectives (skalierbar, robust, präzise)
     - Role-specific terms (Werkstudent, Abschlussarbeit, Probezeit)

2. **Generate Context Sentences**
   - For each term, extract the sentence it appeared in
   - Generate a simpler context sentence if the original is too complex

3. **Export to Anki CSV**
   - Format: `Front,Back,Context`
   - Example row:
     ```
     Bildverarbeitung,Image Processing,"Entwicklung von Bildverarbeitungsalgorithmen für..."
     ```

4. **Track Learning Progress**
   - Append new words to `data/vocab-history.tsv`
   - Show: total words extracted, words already learned, words remaining

**Spaced Repetition Integration:**
- The system should remind the user to review Anki daily
- After 100 words learned, the system should re-scan old job descriptions to find new words using the learned vocabulary as a baseline

### Target Company List (Default `portals.yml` seed)

The following companies should be pre-seeded in `portals.yml` as priority targets:

**Tier 1 — Highest probability (Werkstudent-friendly, English-ok, Berlin):**
- Fraunhofer (all Berlin institutes, especially IML, IPK, FOKUS, HHI)
- TwinCloud GmbH
- Data Spree
- Maddox AI
- Gestalt Robotics

**Tier 2 — Strong fit (international, English-first, Berlin-based):**
- Zalando (ML/CV roles)
- HelloFresh (Data/ML)
- Trade Republic (ML)
- HeyJobs GmbH
- Delivery Hero

**Tier 3 — Worth monitoring (Werkstudent slots only):**
- SAP (Werkstudent only)
- Siemens (Werkstudent only)
- Bosch (Werkstudent only, Berlin office)

**Thesis-Leverage Targets (for outreach, not cold applications):**
- Metro AG (Innovation labs, Düsseldorf)
- REWE Digital (Retail tech, Cologne)
- Schwarz Gruppe (Lidl/Kaufland parent, Neckarsulm)
- Fraunhofer IML (Logistics research, Dortmund)

## Antigravity-First Runtime

Antigravity is the primary runtime target.

Recommended multi-agent split:
- `Manager`
- `ScanAgent`
- `EvaluationAgent`
- `ResearchAgent`
- `PDFAgent`
- `ApplyAgent`
- `ToolAgent`

Rules:
- shared mode files remain the source of truth
- browser-heavy work stays serial
- high-volume scans can use lighter models
- nuanced writing can use stronger models

## Phased Rollout

### Phase 1 -- Seed docs
- `CLAUDE.md`
- `AGENTS.md`
- `PLAN.md`

### Phase 2 -- Fork scaffolding
- copy repo structure
- create Germany-first `modes/`
- create config and template files

### Phase 3 -- German-market scan
- rewrite `portals.yml` defaults
- adapt scan runner
- add freshness verification for German aggregators

### Phase 4 -- Evaluation and PDF logic
- change scoring to Germany-first
- add visa / language / location logic
- add German CV + cover letter flows

### Phase 5 -- Intelligence and Targeting
- company research pipeline (LinkedIn employee scraping, company blogs)
- German vocab extraction for Spaced Repetition/Anki
- advanced tracking dashboard with rejection pattern analysis

### Phase 6 -- Antigravity optimization
- agent topology docs
- editor-specific thin wrappers
- local model and browser stability rules

## Acceptance Scenarios

The finished fork should pass these scenarios:

1. **Berlin `Werkstudent` role, English JD**
   Evaluates strongly, picks English CV variant, still applies Germany-specific comp and visa logic.

2. **German-language ML role with B2 requirement**
   Generates German output, notes language risk realistically, does not auto-reject.

3. **German-language role with C1 requirement**
   Penalizes fit, explains why, and recommends against applying unless there is a special reason.

4. **Full-time role outside Berlin with immediate start**
   Surfaces location and visa friction clearly.

5. **German company with English-first AI team**
   Does not over-penalize German level when the company is clearly international.

6. **Scanner finds the same role on LinkedIn and company site**
   Dedups correctly and prefers the company URL.

7. **Cover letter generation**
   Produces restrained, credible German-market tone instead of US-style hype.

8. **Red flag auto-SKIP (NEW)**
   A Helsing defense role triggers the non-EU citizenship red flag (-1.0) and recommends SKIP.

9. **Burn list warning (NEW)**
   User tries to evaluate a new Black Forest Labs role. System shows: "This company rejected you on [date] for [role]. Earliest reapply: [date+6mo]. Recommend SKIP."

10. **Fraunhofer priority alert (NEW)**
    Scanner discovers a new Fraunhofer CV Werkstudent role in Berlin. System triggers TIER 1 alert with pre-drafted `Anschreiben` and PDF.

11. **Vocab extraction (NEW)**
    User runs `/career-ops vocab` on a German JD. System produces Anki CSV with 15+ technical terms.

12. **Company intelligence brief (NEW)**
    User runs `/career-ops research Metro`. System outputs company summary, 5-10 LinkedIn employees, and personalized outreach templates.

## Assumptions

- The fork is specifically for Sanket-like search constraints unless the user overrides them in `config/profile.yml` and `modes/_profile.md`
- Berlin is the default city
- Germany is the default country
- AI/ML, Computer Vision, and Robotics are the default target clusters
- `Werkstudent` and selective full-time roles are both in scope
- English-friendly German companies remain a major target
- **Quality > Quantity:** The system exists to make 10 applications perfect, not to spam 100
