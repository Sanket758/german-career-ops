# Mode: pdf — ATS-Optimized & German Market PDF Generation

## Complete Pipeline

1. Read `cv.md` as source of truth.
2. Ask for the JD if not in context (text or URL).
3. Extract 15-20 keywords from the JD.
4. Detect JD language → CV language (EN default).
5. Detect company location → paper format:
   - US/Canada → `letter`
   - Rest of world → `a4`
6. Detect role archetype → adapt framing.
7. Rewrite Professional Summary injecting JD keywords + exit narrative bridge.
8. **German Market Check:** If location is Germany:
   - Enforce mandatory personal data (Address, DOB, POB, Nationality, Visa).
   - Enforce professional photo (unless opted out).
   - Set section order: [BERUFSERFAHRUNG, AUSBILDUNG] for experienced, [AUSBILDUNG, BERUFSERFAHRUNG] for students.
9. Select top 2-3 academic projects most relevant to the offer.
10. Include ALL professional roles from `cv.md` (prune bullets if needed, but don't skip roles).
11. Reorder experience bullets by JD relevance.
12. **German Bullet Style:** Remove bold labels (American style). Use plain-text factual descriptions.
13. **Bullet Limits:** Max 3-4 per role (current), 2-3 (previous).
14. Build competency grid from JD requirements (6-8 keyword phrases).
15. Inject keywords naturally into existing achievements (NEVER invent).
16. **Language Consistency:** If JD is German, translate all content to German. If JD is English, keep content English but use German headings if company is German.
17. Generate complete HTML from template + personalized content.
18. Read `name` from `config/profile.yml` → normalize to kebab-case lowercase → `{candidate}`
19. Write HTML to `/tmp/cv-{candidate}-{company}.html`
20. Execute: `node generate-pdf.mjs /tmp/cv-{candidate}-{company}.html output/cv-{candidate}-{company}-{YYYY-MM-DD}.pdf --format={letter|a4} --type=cv --max-pages={1-or-2}`
21. Report: PDF path, page count, % keyword coverage.

## German Market (Lebenslauf) Standards

### 1. Mandatory Photo
German Lebenslauf standard expects a professional photo in the top-right corner (35mm × 45mm).
- Position: Top-right corner of page 1.
- If missing: Create placeholder with text: "[Foto] Professionelles Bewerbungsfoto 35mm × 45mm".

### 2. Personal Data (PERSÖNLICHE DATEN)
Must include:
- Full street address (Street, PLZ, City).
- Phone (International format).
- Email.
- Geburtsdatum (DD.MM.YYYY).
- Geburtsort (City, Country).
- Nationalität (in German, e.g., "Indisch").
- Visum/Arbeitserlaubnis (Work authorization status).

### 3. Section Order
- **Experienced (2+ years):** BERUFSERFAHRUNG first, then AUSBILDUNG.
- **Students/Interns:** AUSBILDUNG first, then BERUFSERFAHRUNG.
- **Research Institutes (Fraunhofer, etc.):** Lead with AUSBILDUNG (emphasize thesis).

### 4. Experience Bullets (German Style)
- **NO BOLD LABELS:** Remove things like "**Computer Vision Pipelines:**".
- **Plain Text:** Use factual, concise descriptions (1-2 lines).
- **Max Bullets:** 4 for current role, 3 for previous roles, 1-2 for internships.

### 5. Experience History
- Include ALL roles from `cv.md`. Never silently drop roles.
- Use "Weitere Erfahrung" section for older/less relevant roles if space is tight.

### 6. Academic Projects
- Select 2-3 relevant projects (not just 1).
- Tailor selection based on JD keywords.

### 7. Open Source
- Include an "OPEN SOURCE" section if the candidate has PyPI packages or major contributions.
- Format: "Package Name — Description: URL".

### 8. Language Consistency
- JD in German → CV fully in German.
- JD in English (German company) → English content, German headings (AUSBILDUNG, KENNTNISSE).
- JD in English (International startup) → Fully English.

### 9. Technical Cleanliness
- **Certifications:** Ensure no trailing blank bullets in the {{CERTIFICATIONS}} block.
- **URLs:** All URLs in Professional Summary must be clickable and use `white-space: nowrap`.
- **Page contract:** Use 1 page for Werkstudent/student CVs and 2 pages only for senior/full-time roles where depth is necessary. If `generate-pdf.mjs` fails page validation, prune before applying; never attach an over-limit PDF.

## Cover Letter Page Contract

- Hard limit: 1 A4 page for Germany.
- Structure: recipient/date metadata + 3-4 concise paragraphs + short closing. Avoid long bullet lists unless the portal explicitly asks for a structured motivation answer.
- Generate PDF with `node generate-cover-letter-pdf.mjs output/cover-letter-{company}.md`.
- If page validation fails, shorten the body. Do not reduce font sizes below the script's compression pass manually.

## ATS Rules (clean parsing)

- Single-column layout (no sidebars, no parallel columns).
- Standard headers: "Professional Summary", "Work Experience", "Education", "Skills", "Certifications", "Projects".
- No text in images/SVGs.
- No critical info in PDF headers/footers.
- UTF-8, selectable text (not rasterized).
- No nested tables.

## PDF Design

- **Fonts**: Space Grotesk (headings) + DM Sans (body).
- **Header**: Name in 24px bold + gradient line + contact row + personal data block + photo.
- **Section headers**: 12px, uppercase, cyan primary color, border-bottom.
- **Margins**: 0.6in.

## HTML Template

Use the template at `cv-template.html`. Replace the `{{...}}` placeholders:

| Placeholder | Content |
|-------------|---------|
| `{{PHOTO}}` | Image tag or placeholder div |
| `{{PERSONAL_DATA}}` | HTML block with DOB, POB, Nationality, Visa |
| `{{EXPERIENCE}}` | HTML for all jobs (plain bullets, pruned) |
| `{{PROJECTS}}` | HTML for 2-3 tailored academic projects |
| ... | (rest of existing placeholders) |


## Canva CV Generation (optional)

If `config/profile.yml` has `canva_resume_design_id` set, offer the user a choice before generating:
- **"HTML/PDF (fast, ATS-optimized)"** — existing flow above
- **"Canva CV (visual, design-preserving)"** — new flow below

If the user has no `canva_resume_design_id`, skip this prompt and use the HTML/PDF flow.

### Canva workflow

#### Step 1 — Duplicate the base design

a. `export-design` the base design (using `canva_resume_design_id`) as PDF → get download URL
b. `import-design-from-url` using that download URL → creates a new editable design (the duplicate)
c. Note the new `design_id` for the duplicate

#### Step 2 — Read the design structure

a. `get-design-content` on the new design → returns all text elements (richtexts) with their content
b. Map text elements to CV sections by content matching:
   - Look for the candidate's name → header section
   - Look for "Summary" or "Professional Summary" → summary section
   - Look for company names from cv.md → experience sections
   - Look for degree/school names → education section
   - Look for skill keywords → skills section
c. If mapping fails, show the user what was found and ask for guidance

#### Step 3 — Generate tailored content

Same content generation as the HTML flow (Steps 1-11 above):
- Rewrite Professional Summary with JD keywords + exit narrative
- Reorder experience bullets by JD relevance
- Select top competencies from JD requirements
- Inject keywords naturally (NEVER invent)

**IMPORTANT — Character budget rule:** Each replacement text MUST be approximately the same length as the original text it replaces (within ±15% character count). If tailored content is longer, condense it. The Canva design has fixed-size text boxes — longer text causes overlapping with adjacent elements. Count the characters in each original element from Step 2 and enforce this budget when generating replacements.

#### Step 4 — Apply edits

a. `start-editing-transaction` on the duplicate design
b. `perform-editing-operations` with `find_and_replace_text` for each section:
   - Replace summary text with tailored summary
   - Replace each experience bullet with reordered/rewritten bullets
   - Replace competency/skills text with JD-matched terms
   - Replace project descriptions with top relevant projects
c. **Reflow layout after text replacement:**
   After applying all text replacements, the text boxes auto-resize but neighboring elements stay in place. This causes uneven spacing between work experience sections. Fix this:
   1. Read the updated element positions and dimensions from the `perform-editing-operations` response
   2. For each work experience section (top to bottom), calculate where the bullets text box ends: `end_y = top + height`
   3. The next section's header should start at `end_y + consistent_gap` (use the original gap from the template, typically ~30px)
   4. Use `position_element` to move the next section's date, company name, role title, and bullets elements to maintain even spacing
   5. Repeat for all work experience sections
d. **Verify layout before commit:**
   - `get-design-thumbnail` with the transaction_id and page_index=1
   - Visually inspect the thumbnail for: text overlapping, uneven spacing, text cut off, text too small
   - If issues remain, adjust with `position_element`, `resize_element`, or `format_text`
   - Repeat until layout is clean
d. Show the user the final preview and ask for approval
e. `commit-editing-transaction` to save (ONLY after user approval)

#### Step 5 — Export and download PDF

a. `export-design` the duplicate as PDF (format: a4 or letter based on JD location)
b. **IMMEDIATELY** download the PDF using Bash:
   ```bash
   curl -sL -o "output/cv-{candidate}-{company}-canva-{YYYY-MM-DD}.pdf" "{download_url}"
   ```
   The export URL is a pre-signed S3 link that expires in ~2 hours. Download it right away.
c. Verify the download:
   ```bash
   file output/cv-{candidate}-{company}-canva-{YYYY-MM-DD}.pdf
   ```
   Must show "PDF document". If it shows XML or HTML, the URL expired — re-export and retry.
d. Report: PDF path, file size, Canva design URL (for manual tweaking)

#### Error handling

- If `import-design-from-url` fails → fall back to HTML/PDF pipeline with message
- If text elements can't be mapped → warn user, show what was found, ask for manual mapping
- If `find_and_replace_text` finds no matches → try broader substring matching
- Always provide the Canva design URL so the user can edit manually if auto-edit fails

## Post-generation

Update tracker if the offer is already registered: change PDF from ❌ to ✅.
