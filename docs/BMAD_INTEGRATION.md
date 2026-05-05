# BMAD Integration

Career-Ops should use BMAD for product and engineering changes to this system,
not for the normal job-search runtime.

## Local BMAD Install

Local path:

```text
/home/sanket758/Tools/BMAD
```

Observed structure:

```text
/home/sanket758/Tools/BMAD/.agent/skills/
/home/sanket758/Tools/BMAD/_bmad/
/home/sanket758/Tools/BMAD/_bmad-output/
```

This install exposes BMAD as agent skills rather than a checked-in
`.bmad-core/` directory inside Career-Ops. Keep Career-Ops runtime files here
and write BMAD planning/test artifacts to BMAD's output folders or to
Career-Ops `docs/` when they become project documentation.

## When To Use BMAD

Use BMAD for:
- Dashboard redesign PRD and UX flows.
- Architecture decisions for background scanning, PDF validation, and data contracts.
- Implementation stories with acceptance criteria.
- QA checklists for scan loop, tracker updates, PDF page counts, and dashboard links.

Do not use BMAD for:
- Running scans.
- Evaluating a single job.
- Generating one CV or cover letter.
- Updating tracker status.

Those are operational workflows and should stay script-first to control tokens.

## Suggested Artifact Map

| BMAD artifact | Career-Ops equivalent |
| --- | --- |
| PRD | `docs/dashboard-prd.md` or BMAD planning artifact |
| Architecture | `docs/ARCHITECTURE.md` plus `docs/CONTEXT_BUDGET.md` |
| Story | Small implementation issue/task with exact file ownership |
| QA checklist | `test-all.mjs`, PDF page validation, dashboard API health |

## Role Mapping

| BMAD role | Career-Ops use |
| --- | --- |
| PM | Define dashboard workflow and success metrics |
| Architect | Define data contracts and service boundaries |
| Dev | Implement scripts/API/UI in scoped patches |
| QA | Verify page limits, scanner loop behavior, dashboard links |

BMAD should produce stable artifacts and scoped stories. The runtime command
path remains:

```text
deterministic script -> compact session state -> selective agent reasoning
```
