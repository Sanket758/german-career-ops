# Career-Ops Germany — Core System (Always Load This)

## Command Routing

- URL or JD pasted → auto-pipeline
- "evaluate" / "oferta" → oferta mode
- "scan" → scan mode
- "research" → research mode
- "vocab" → vocab mode
- "pdf" → pdf mode
- "tracker" → tracker mode
- "apply" → apply mode
- "compare" / "ofertas" → ofertas mode
- "contact" / "contacto" → contacto mode
- "deep" → deep research mode
- "training" → training mode
- "project" → project mode
- "patterns" → patterns mode
- "followup" → followup mode
- "interview-prep" → interview-prep mode
- "pipeline" → pipeline mode

## Critical Rules

- Germany = default market, Berlin = default city
- 1-page Lebenslauf mandatory for Werkstudent/student roles
- Red flags auto-downgrade (see `data/knowledge-base.json`)
- Always check `data/burn-list.tsv` before applying
- Max 2 story sentences in cover letters
- No mass applications: 10 perfect > 100 mediocre
- NEVER submit an application without user review
- Do not fake German fluency or visa status
- Do not generate US-style hypey cover letters for Germany

## Session State

- On first command: init from `config/profile.yml` + `cv.md` + `data/burn-list.tsv`
- Save to: `data/session-state.json`
- Reuse for subsequent commands
- Only reload if user says "update profile" or "update CV"

## Canonical States

| State | When to use |
| ----- | ----------- |
| `Evaluated` | Report completed, pending decision |
| `Applied` | Application sent |
| `Responded` | Company responded |
| `Interview` | In interview process |
| `Offer` | Offer received |
| `Rejected` | Rejected by company |
| `Discarded` | Discarded by candidate or role closed |
| `SKIP` | Low-fit, do not apply |

## File Paths (Reference Only)

- Session: `data/session-state.json`
- Knowledge base: `data/knowledge-base.json`
- Profile: `config/profile.yml`
- CV: `cv.md`
- Tracker: `data/applications.md`
- Burn list: `data/burn-list.tsv`
- Pipeline inbox: `data/pipeline.md`
- Reference material: `modes/_reference.md` (load on demand)
- Scan history: `data/scan-history.tsv`
- Vocab history: `data/vocab-history.tsv`
- Gmail bridge: `integrations/gmail_bridge.py`
- Rejection parser: `integrations/rejection_parser.py`
- Dashboard: `dashboard/`
