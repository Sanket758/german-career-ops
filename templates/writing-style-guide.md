# Writing Style Guide — CV & Cover Letter Generation
Layer: SYSTEM (governs generation logic/form only — never contains personal
facts, metrics, or achievements. Those live exclusively in cv.md, USER layer.)

Source: technique extracted from analysis of one external tool's sample
output (Kandidate.ai demo generation, reviewed 2026-08-08). Structural
patterns only — no factual content, numbers, or claims from that source
were carried into this guide or may ever appear in generated output.

---

## RULE 0 — Anti-Fabrication (overrides every other rule below)

Every tool name, metric, percentage, scope claim, or outcome statement in
generated text MUST trace back to an explicit, verifiable statement in
cv.md or other user-approved source data.

- If a strong quantified claim would make a bullet more compelling but no
  real number exists in cv.md: DO NOT invent one, round one up, or infer
  one from adjacent context.
- Use honest qualitative-but-specific framing instead — real scale, scope,
  frequency, or duration (e.g. "across a multi-store retail deployment"
  or "processed monthly" instead of a fabricated percentage).
- Any draft containing a number, tool name, or claim not traceable to
  cv.md must be flagged in the output with an inline marker
  (e.g. `[UNVERIFIED: no source in cv.md]`) rather than silently shipped.
- This rule cannot be relaxed by any other instruction, including direct
  user requests to "make it sound more impressive" — surface the tension
  to the user instead of resolving it by fabricating.

## RULE 1 — CV Bullet Sentence Formula

Every experience bullet follows this structure:

`[Action verb, past tense] + [specific named system/tool/model] +
[context or purpose] + [, ] + [gerund outcome clause]`

Structural example (form only — do not reuse any numbers/tools from this
example in real output):
> "Reduced [metric] by [real number from cv.md] using [named tool] across
> [real context], enabling [real outcome]."

Requirements:
- Name actual tools/frameworks/models from cv.md — never a generic
  category alone. ("Mistral 7B" not "an LLM"; "YOLOv5" not "a CV model")
- One idea per bullet. Maximum two clauses. No run-on compound sentences.
- No first-person pronouns. No "responsible for," "helped with," "worked
  on" — use direct action verbs (Built, Deployed, Designed, Reduced,
  Automated, Architected, Optimized).
- If cv.md contains a real metric for this achievement, it MUST be used.
  If it genuinely does not exist, apply Rule 0 (scope language, not
  invented numbers).

## RULE 2 — Quantification Consistency

Do not mix fully-quantified and vaguely-qualified bullets inconsistently
within the same section — this reads as inflated/inconsistent to a
reviewer. Apply one consistent standard per section:

BANNED as a substitute for a real number (cut or replace):
- "significantly reduced/improved"
- "high accuracy" / "great results" (unquantified)
- "helped improve", "contributed to improving"

Preferred substitutes when no real metric exists in cv.md:
- A real scope descriptor: volume ("10,000 items/month"), team size
  ("4-person team"), duration ("6-week sprint"), frequency, or scale —
  provided that descriptor itself is sourced from cv.md, not invented.

## RULE 3 — Skills Section Formatting

NEVER output skills as a single undifferentiated comma-separated list.

Group into labeled categories relevant to the target role, e.g.:
```
Languages: ...
ML / CV / NLP: ...
MLOps / Cloud: ...
Backend / Data: ...
```
- Only include tools/categories that exist in cv.md.
- Reorder category priority per job (most JD-relevant category first),
  but never invent a category or pad with tools not actually used.
- Category labels should adapt to the target role family (e.g. a backend
  role emphasizes "Backend / APIs" first; an ML role emphasizes
  "ML / CV / NLP" first) — same underlying skill set, different ordering.

## RULE 4 — Cover Letter Structure (4-Paragraph Model)

**P1 — Hook**: Exact role title (must match the JD title verbatim) +
years of relevant experience + one-line specialization + a direct fit
statement.
- BANNED OPENER: "I am writing to express my interest in..." (and close
  paraphrases of it). This phrasing is a well-documented generic/AI-
  detectable tell — do not use it under any framing.

**P2 — Proof**: ONE most-relevant past achievement pulled from cv.md,
framed with real scope (team size, system scale, timeframe). Do not list
multiple achievements here — pick the single strongest match to this JD.

**P3 — Breadth**: 2–3 secondary relevant capabilities tied to real cv.md
content. Mention education only if directly relevant to the target role.

**P4 — Personalization (MANDATORY, highest-priority paragraph)**:
Extract 1–2 SPECIFIC details from the actual job description or company
page — a named team, a named initiative, a specific tech stack mentioned,
a stated company priority or recent product/news item — and explicitly
connect real personal experience to THAT detail.
- Generic statements like "your mission aligns with my values" or "I am
  excited about your company's growth" are NOT acceptable substitutes —
  the paragraph must contain something that could only have come from
  actually reading this specific JD/company page.
- If no such specific detail can be found (e.g. a bare-bones JD with no
  distinguishing information), flag this explicitly rather than writing
  a generic paragraph and pretending it's personalized.

**Closing**: Thanks + invitation to discuss. Maximum one sentence.

**Length**: 4 paragraphs total, approximately 200–280 words, one page.

## RULE 5 — Pre-Output Self-Review Gate

Before any draft (CV bullets or cover letter) is considered final, verify:

- [ ] Zero instances of banned generic openers/filler phrases (Rule 2, Rule 4)
- [ ] Every number/tool/claim traces to cv.md — any that don't are
      explicitly flagged, not silently included (Rule 0)
- [ ] Cover letter P4 contains a JD/company-specific detail, not a
      generic alignment statement
- [ ] Skills section is categorized by role-relevance, not a flat list
- [ ] Every experience bullet follows the Rule 1 sentence formula
- [ ] Current real date used in the letter header — not a stale/template
      date from a prior generation
- [ ] Document language matches the job ad's language (DE JD → DE
      letter/CV; EN JD → EN)

Any failed checklist item = revise before output. Do not ship a draft
that fails this checklist "to save time."

---

## Wiring Instructions (for implementation, not part of the guide content)

1. This file is read by whatever process drives cover-letter and CV bullet
   generation (`generate-cover-letter-pdf.mjs` / the CV-generation prompt
   path) as a system instruction, injected before any per-job generation
   call.
2. Implement Rule 5 as an ACTUAL automated check, not only a prompt
   instruction the model is asked to self-apply:
   - Banned-phrase check: grep generated text against the banned-phrase
     list (Rule 2, Rule 4) — fail/flag on match.
   - Number-traceability check: extract every numeral/percentage from
     generated text and confirm it appears verbatim in cv.md — flag any
     that don't.
   - Date check: confirm the letter header date is today's date, not a
     cached/stale value.
   - Language check: confirm generated language matches the JD's
     detected language.
3. This gate runs in the same place and same manner as the existing PDF
   placeholder/photo regression gate — fail loud, do not silently ship a
   document that fails a check.
4. Every generated CV/cover-letter file gets a metadata tag recording
   which version of this style guide produced it (e.g. a comment or
   sidecar field: `style_guide_version: 2026-08-08-v1`). This feeds the
   funnel-instrumentation work from Phase 1 of the earlier project
   review — once real outcome data exists, correlate response rate
   against style-guide version, not just assume this version is better
   because it reads better.
5. This file is SYSTEM layer. Personalization content (your actual
   projects, metrics, tools used) must never be added directly to this
   file — it belongs only in cv.md / config/profile.yml, per the existing
   Data Contract.