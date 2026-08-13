# JobTrackr Dashboard — UI Interaction Graph Audit

**Generated:** 2026-08-13 · **State:** post-Wave-2 (tsc clean) · **35 nodes / 33 links**

Machine-readable version: `interaction-graph.json`

---

## Verdict: 8 of 35 interactive elements are dead, fake, or broken

| # | Node | Type | Problem | Fix |
|---|------|------|---------|-----|
| 1 | `settings-tab` | **Dead tab** | Sidebar has Settings nav, but `App.tsx` has NO `activeTab==='settings'` body — `SettingsPanel.tsx` (complete component) is never mounted. Clicking Settings = blank page | Mount `<SettingsPanel config={config} onConfigChange={setConfig} />` at `activeTab==='settings'` |
| 2 | `detail-status-sync` | **Broken sync** | Status dropdown writes via `updateApplicationStatus → PUT /api/applications/:id`, but `ApplicationDetail` has no `onStatusChange` prop — `App.tsx` passes only `application/onClose`. Table + pipeline stay stale until manual reload | Add `onStatusChange` prop; in App, update `applications` state from the API result |
| 3 | `new-application-btn` | **Fake** | `handleNewApplication` = `alert()` telling user to use the CLI. No GUI form, even though `POST /api/applications` exists in api.mjs | Build a New Application modal → `POST /api/applications` → refresh |
| 4 | `apply-flow` | **Missing feature** | "Open Job Posting" exists, but there's no dedicated **Apply Now** (open jobUrl new tab) + **Mark as Applied** (updates tracker) pair, and no inline CV/CL generation | Queued requirement — Apply Now / Mark as Applied / Generate CV+CL in detail modal |
| 5 | `sidebar-notifications` / `sidebar-autorefresh` | **Dead config** | Stored into `config` but no consumer reads them | Implement consumers or drop the toggles |
| 6 | `profile-role-chips` | **Misleading** | Hover styles on target-role chips but no `onClick` | Remove hover styles or make them clickable |
| 7 | `actionbar-generate-cv` | **Hardcoded** | `generateCV({company:'Sanket', lang:'both'})` — ignores actual context | Pass company from selected app |
| 8 | `cmd-k-search` | **Cosmetic** | ⌘K kbd hint with no keyboard handler | Wire a real shortcut or remove the hint |

---

## Working graph (27 nodes)

```
NAV        overview / pipeline / applications / burn-list / generate  → setActiveTab      ✅
           burn-list "View All →"                                      → setActiveTab      ✅
SIDEBAR    collapse · showRejected/Discarded/Skipped · compact ·
           darkCharts · sortBy · viewMode(table/kanban)                → setConfig         ✅
HEADER     search                                                        → table filter    ✅
ACTIONS    Sync Gmail · Scan Portals · Reload                            → API + loadData   ✅
           Generate CV                                                    → generateCV()    ✅
ACTIVITY   9 filter chips                                                 → setFilter       ✅
PIPELINE   row click                                                      → open detail     ✅
TABLE      status filter · column sort · row · job↗ · pdf↗ · report↗      → detail/links    ✅
DETAIL     close/backdrop/Esc · status dropdown · dismiss · artifacts ·   → API + links     ✅
           Open Job Posting ↗
BURNLIST   All / Cooldown / Ready                                          → setFilter       ✅
GENERATE   CV fields+submit · expand · pdf · CL research+generate · pdf ·
           OutputFiles refresh+download · Scan trigger+url                 → API             ✅
```

---

## Recommended execution order (ties into gauntlet)

1. **Mount SettingsPanel** (fix dead tab — smallest, unlocks Settings config)
2. **Wire `onStatusChange`** through `App.tsx` (fix stale UI — unblocks apply flow)
3. **Apply flow** (queued requirement): Apply Now + Mark as Applied + Generate CV/CL inline
4. **New Application modal** (`POST /api/applications`)
5. Cleanup: dead config, misleading chips, hardcoded company, ⌘K
6. Visual QA per module (header first), then commit