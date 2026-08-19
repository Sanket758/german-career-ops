# Deep Analysis: Career-Ops Pipeline Reform for German Market

## Executive Summary
After 5 months using career-ops, **0 job offers** despite 66 tracked applications. The system is optimized for US-style "spray-and-pray" volume but fails in Germany where:
- **Quality > Quantity** (German hiring values depth, not breadth)
- **CV format matters** (tabellarischer Lebenslauf, photo optional but common, specific structure)
- **Cover letters are mandatory** (Anschreiben - not optional like US)
- **German language is a hard gate** (B1 = auto-rejection at many companies)
- **Visa status clarity is critical** (employers need to know exact timeline)
- **Networking/referrals dominate** (XING, LinkedIn DACH, alumni networks)
- **Timing is everything** (August graduation = September hiring wave)

---

## Current Pipeline Failure Modes

### 1. **Wrong Metrics / Wrong Game**
| Metric | Current | German Reality |
|--------|---------|----------------|
| Applications tracked | 66 | 66 "applications" but only **3 PDFs generated** |
| High-score (>=4.0) not applied | 21 | **21 quality applications never submitted** |
| PDFs generated | 3 | **Only 3 companies got tailored materials** |
| LinkedIn auto-applied | 12 | **Low-quality, untailored, likely auto-rejected** |
| Cover letters | 0 | **Mandatory in Germany** |

### 2. **German Market Mismatches**

**A. CV Format**
- Current: US-style markdown CV → HTML → PDF
- German: **Tabellarischer Lebenslauf** (reverse chronological, 2 pages max, specific sections)
- Photo: Expected in traditional companies (Mittelstand, corp), optional in tech/startups
- Sections required: Persönliche Daten, Ausbildung, Berufserfahrung, Kenntnisse, Projekte, Ehrenamt/Sprachen

**B. Cover Letter (Anschreiben)**
- Current: Not generated at all
- German: **1-page, addressed to person, references specific JD requirements, shows company research**
- Must answer: "Warum genau dieses Unternehmen? Warum genau diese Rolle? Warum jetzt?"

**C. Language Gate**
- B1 German = auto-filter at 60%+ of German companies
- Only English-speaking teams (international startups, big tech) consider B1
- System doesn't flag this per-application

**D. Visa Communication**
- Current: "Full-time from Aug 28" in CV footer
- German: Needs **explicit visa status section** in cover letter + CV
- Employers need: "§20 job-seeker visa → §18g work permit, no sponsorship needed"
- Must state: "Available for interview immediately, can start Sept 1"

**E. Salary Expectations**
- Current: €50-65K in profile
- German: Must state **Bruttojahresgehalt** in cover letter if asked
- Blue Card threshold: €45,934 (IT shortage) / €50,700 (general) - critical for visa

### 3. **Application Quality Issues**

**What "Applied" Actually Means Currently:**
- 12 LinkedIn EasyApply (one-click, no CV upload, no cover letter) → **~0% response rate**
- 3 companies got PDF CVs (SAP, eternal.ag, Helsing) → **these had human review**
- 21 high-score applications = "Evaluated" status only → **never submitted**

**German Recruiter Reality:**
- 6-10 second CV scan (ATS + human)
- Cover letter read if CV passes scan
- **Missing cover letter = auto-reject** at most companies
- Generic CV = reject (no tailoring to JD)

---

## Reform Strategy: "German-First Pipeline"

### Phase 1: Fix the Output (Week 1)
1. **German CV Generator** - tabellarischer Lebenslauf format
2. **Cover Letter Generator** - Anschreiben per JD, addressed to hiring manager
3. **Per-Application Package** - CV + Cover Letter + Certificates (Zeugnisse) as single PDF
4. **Visa Clarity Module** - explicit section in both CV and cover letter

### Phase 2: Fix the Input/Selection (Week 1-2)
1. **German Job Board Integration** - StepStone, XING, Arbeitsagentur, Arbeitnow, BerlinStartupJobs
2. **Company Research Automation** - auto-fetch: hiring manager name, tech stack, recent news, German Glassdoor/Kununu
3. **Language Gate Scoring** - auto-detect German requirement in JD, score accordingly
4. **Referral Path Detection** - find alumni, XING contacts, LinkedIn 2nd-degree at target companies

### Phase 3: Fix the Process (Week 2)
1. **Application Workflow** - "One role = one tailored package = one submission = track response"
2. **Follow-up Automation** - 7-day, 14-day, 21-day follow-up templates (German business etiquette)
3. **Interview Prep** - German-style: technical test, cultural fit, salary negotiation (German norms)
4. **Weekly Cadence** - Monday: select 5 roles, Tuesday: generate packages, Wednesday: apply, Thursday: follow-ups

### Phase 4: German Market Intelligence (Ongoing)
1. **Hiring Calendar** - know when companies hire (Sept, Jan, post-summer)
2. **Company Tier Lists** - which companies sponsor, which are English-friendly, which are ghost-posters
3. **Recruiter Contacts** - build database of technical recruiters at target companies
4. **Salary Benchmarks** - per role, per city, per company size (German data)

---

## Immediate Actions (Do This Week)

### 1. Stop LinkedIn EasyApply
- **Delete** `scripts/linkedin_batch_apply.mjs` - it produces garbage applications
- **Delete** auto-applied entries from tracker (12 entries, 0 responses)

### 2. Generate Real Packages for 21 High-Score Roles
- 21 roles scored >=4.0, status "Evaluated" → **generate CV + Cover Letter PDFs NOW**
- Submit manually via company portal / email to hiring manager

### 3. Rewrite CV for German Market
```
Current: US-style, 2 pages, skills-heavy
Target:  Tabellarischer Lebenslauf, 2 pages max, reverse chronological
Sections:
  1. Persönliche Daten (name, address, phone, email, LinkedIn, GitHub, visa status)
  2. Berufserfahrung (reverse chron, 4-5 bullets per role, metrics)
  3. Ausbildung (MSc AI Berlin first, then BEng)
  4. Technische Kompetenzen (grouped: ML/CV, MLOps, Robotics, Languages)
  5. Projekte (3-4 key, one-line + metric)
  6. Sprachen (Deutsch B1, Englisch C1)
  7. Ehrenamt/Interessen (optional - shows culture fit)
```

### 4. Create Cover Letter Template (German + English)
```
Structure:
- Header: Your info + Company info + Date
- Betreff: Bewerbung als [Role] - [Ref # if any]
- Anrede: "Sehr geehrte Frau Müller," / "Dear Ms. Müller,"
- Opening: Why this company (1-2 sentences, specific)
- Body: 2-3 paragraphs mapping JD requirements → your proof points
- Visa: "Ab 28.08.2026 uneingeschränkt vollzeitbeschäftigbar (§20 AufenthG → §18g, kein Sponsoring nötig)"
- Closing: "Über eine Einladung zum persönlichen Gespräch freue ich mich."
- Grußformel: "Mit freundlichen Grüßen"
```

---

## System Architecture Changes

### Delete / Archive
- `scripts/linkedin_batch_apply.mjs` → archive
- `scripts/linkedin_attach.mjs` → archive  
- `scripts/linkedin_easyapply.mjs` (already gone)
- `scripts/linkedin_scan.py` → archive
- Auto-applied tracker entries → archive

### Create New
```
scripts/
├── generate-german-cv.mjs       # Tabellarischer Lebenslauf (HTML → PDF)
├── generate-anschreiben.mjs     # Cover letter per JD + company research
├── generate-application-pkg.mjs # Combine CV + Cover Letter + Zeugnisse
├── german-job-boards.mjs        # StepStone, XING, Arbeitnow, Arbeitsagentur APIs
├── company-research.mjs         # Hiring manager, tech stack, Kununu, news
├── language-gate.mjs            # Detect German req in JD, flag applications
├── referral-finder.mjs          # XING/LinkedIn alumni at target companies
├── followup-automation.mjs      # 7/14/21 day German follow-up templates
├── salary-benchmark.mjs         # German salary data per role/city
└── interview-prep-de.mjs        # German interview questions, salary negotiation

modes/
├── de/
│   ├── cv-template.html         # German CV template
│   ├── anschreiben-template.html # Cover letter template
│   ├── eval-de.md               # German evaluation (German JD → German output)
│   └── vocab-de.md              # German tech vocab for CV/CL
├── eval-de.md                   # English evaluation for German JDs
└── apply-de.md                  # German application workflow
```

### Modify Existing
- `scripts/generate-pdf.mjs` → route to German CV + Anschreiben
- `scripts/career_ops_cli.py` → add `package` command (generate full application package)
- `modes/_shared.md` → add German market rules
- `modes/_profile.md` → add German-specific proof points, visa narrative

---

## Success Metrics (New Definition)

| Metric | Target |
|--------|--------|
| Tailored packages submitted/week | 5-10 |
| Cover letter + CV per application | 100% |
| Response rate (screening call) | >20% |
| Interview rate | >10% |
| Offer rate | >5% |
| Time to offer | <8 weeks |

---

## Implementation Priority

1. **CRITICAL** (This week): German CV + Cover Letter generators + apply to 21 high-score roles
2. **HIGH** (Week 2): German job board scanner + company research + language gate
3. **MEDIUM** (Week 3): Referral finder + follow-up automation + interview prep
4. **ONGOING**: Salary benchmarks + hiring calendar + recruiter database

---

## Git Strategy
- **Archive current state**: `git tag archive-pre-reform-2026-08-19`
- **New branch**: `german-reform` 
- **Keep**: `cv.md`, `config/profile.yml`, `portals.yml`, `data/` (history)
- **Rewrite**: everything else with German-first architecture

---

*This reform shifts from "volume scanning" to "targeted German applications with proper materials." The German market rewards preparation, not volume.*