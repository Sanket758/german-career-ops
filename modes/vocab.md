# Mode: vocab — German Technical Vocabulary Flashcards

## Purpose
Extract German technical vocabulary from JDs and generate Anki flashcards.
Addresses the B1 → B2 gap that blocks German-required roles.

## Input
- German JD text (pasted) or URL
- `data/vocab-history.tsv` (already-extracted words)

## Workflow

### Step 1: Extract German Technical Terms
Parse the JD. Categorize by:
- **Technical verbs:** entwickeln, implementieren, optimieren
- **Technical nouns:** Bildverarbeitung, Maschinelles Lernen, Regelung
- **Adjectives:** skalierbar, robust, präzise
- **Role-specific:** Werkstudent, Abschlussarbeit, Probezeit
- **Benefits/HR:** bAV, VWL, Urlaubsgeld, Gleitzeitkonto

Skip English loanwords used as-is. Skip words already in `data/vocab-history.tsv`.

### Step 2: Generate Context Sentences
For each term: extract the original JD sentence + generate a simpler sentence + English translation.

### Step 3: Export to Anki CSV
Format: `Front;Back;Context;Category;Source`
Save to `output/anki-[source-slug]-[YYYY-MM-DD].csv`

### Step 4: Update Progress Tracker
Append to `data/vocab-history.tsv`.

### Step 5: Show Progress Summary
Show: new words, already known, total, by-category breakdown, daily review reminder.

## Spaced Repetition Rules
- Daily reminder if >10 unlearned words exist
- At 100 words: re-scan old JDs for new vocabulary
- Track word frequency across JDs (3+ appearances = high priority)

## Usage
```
/career-ops vocab [paste German JD]
/career-ops vocab https://fraunhofer.de/jobs/werkstudent-ml
/career-ops vocab progress
```
