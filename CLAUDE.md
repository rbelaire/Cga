# Carencro Golf Association (CGA) — Engineering Context

## Architecture
- **React 19 + Vite**, Tailwind CSS, React Router v7 (HashRouter)
- **Firebase Firestore + Firebase Auth** back end for live and admin data
- Static JSON retained for baseline site metadata (schedule, board, sponsors)
- Build output goes to `out/` (gitignored); run with `node_modules/.bin/vite build --outDir out`

## Routing
Uses `HashRouter` (`#/path`). Routes defined in `src/App.jsx`.

**Main routes:**
- `/` — Home
- `/tournaments` — schedule cards + completed results view
- `/tournaments/:tournamentId` — tournament detail
- `/standings` — PTM standings + HDCP/Scratch POY displays
- `/most-improved` — Most / Least Improved page (PTM delta from season start)
- `/pairings/:tournamentId` — member pairings (public)
- `/members` — member directory
- `/info` — rules, eligibility, board tabs
- `/sponsors` — sponsor directory
- `/login` — Firebase Auth login
- `/admin` — auth-gated admin panel (lazy-loaded)

**Legacy redirects:** `/schedule`, `/results` → `/tournaments` · `/points-to-make`, `/poy` → `/standings` · `/rules`, `/board`, `/eligibility` → `/info`

## Data sources
### Static (`src/data/`)
- `schedule.json` — season tournament metadata
- `board.json` — board page content
- `sponsors.json` — sponsor content

### Firestore
Public views subscribe via `useFireData` and fall back gracefully when data is unavailable.

**Single-document collections (`cga/*`):**
| Document | Purpose |
|---|---|
| `members` | Member roster with flight, PTM, tee |
| `standings` | Current PTM standings per flight |
| `poy` | Player-of-Year points per flight |
| `ptm` | PTM list (redundant with members in some flows) |
| `beginningOfYearPtm` | Season-start PTM snapshot for Most Improved |
| `credits` | Credit balances per member |
| `users` | Admin/user roles |
| `changelog` | Append-only audit log |
| `creditTransactions` | Append-only credit transaction log |
| `tournamentStatus` | Site-wide tournament lifecycle overrides |

**Per-tournament collections (key = tournament ID):**
| Collection | Purpose |
|---|---|
| `cgaResults/{tid}` | Published result doc (leaderboard, winners) |
| `cgaScores/{tid}` | Score entry data (pre-publish) |
| `cgaPairings/{tid}` | Pairing groups |
| `cgaPayments/{tid}` | Paid/entered player map |
| `cgaPaymentMeta/{tid}` | Payment metadata (credit used, timestamps) |
| `cgaLifecycle/{tid}` | Pairings state, memo/payout flags |

**Append-only:** `cgaSnapshots/{autoId}` — snapshot/restore records

`DB.batchPublish(tid, {resultDoc, newPoy, newStandings})` writes all three in a single Firestore batch.

## Admin panel (`src/pages/Admin.jsx`)

### adminMode values
| Value | Nav label | What it shows |
|---|---|---|
| `'dashboard'` | Overview | Workflow status cards per tournament |
| `'payments'` | Entries | Mark players paid/entered |
| `'pairings'` | Pairings | Generate/edit pairings + Pairing Rules tab |
| `'scores'` | Scores | Score entry per flight |
| `'exports'` | Exports | PDF/XLSX exports |
| `'operations'` | Player Management | Flight, PTM, tee overrides |
| `'bulk-import'` | Bulk Import | CSV/XLSX bulk import |
| `'users'` | Member Management | User account management |
| `'snapshots'` | Snapshots | Snapshot/restore |
| `'changelog'` | Changelog | Audit log |

### dirtyRegistry sections
Tracks unsaved local state vs. cloud for: `scores`, `pairings`, `members`, `credits`, `payments`, `users`. Each has a `saveAction` string; `saveAllDirtyDrafts()` iterates them.

### localStorage keys (all drafts are browser-local until saved)
| Key | Contents |
|---|---|
| `cga_admin_v1` | Score entry data |
| `cga_pairings_v1` | Pairings by tournament |
| `cga_members_v1` | Member flight/PTM/tee overrides |
| `cga_credits_v1` | Credits |
| `cga_payments_v1` | Payments |
| `cga_users_v1` | Users draft |
| `cga_tournament_info_v1` | Tournament info drafts |
| `cga_tournament_lifecycle_v1` | Pairings state, memo/payout flags |
| `cga_payment_meta_v1` | Payment metadata |
| `cga_pairing_rules_v1` | Pairing rules (global, not per-tournament) |

### Publish workflow
1. Admin enters scores in **Scores** panel (`data` state, keyed by `[tid][flight]`)
2. Update member PTM to post-event values in **Player Management** before publishing — `ptmLookup` (from members) is what gets written to standings, not the score-row PTM
3. **Preview** builds payload via `buildPublishPayload()` in `publishService.js`
4. On confirm, snapshots current results/standings/poy, then `DB.batchPublish` writes atomically:
   - `cgaResults/{tid}` — leaderboard, flight winners, status = 'completed'
   - `cga/standings` — updated PTM, PTM delta, trend, event count
   - `cga/poy` — updated POY points per flight

**Key distinction:** score-row PTM = pre-event (used for plus/minus); members PTM = post-event (stored in standings after publish).

## Pairings system

### Auto-generate algorithm
1. **Always-together rules** — seed those players into the same group first (capped at 4; extras fall into normal distribution)
2. **Flight-diversity distribution** — round-robin across flight queues so each group gets players from different flights
3. **Never-together enforcement** — post-process: relocate violating players to groups with open slots and no other rule members (best-effort)

### Pairing rules (`pairingRules` state)
```
[{ id: string, type: 'always' | 'never', players: string[] }]
```
- Stored globally in `cga_pairing_rules_v1` (not per-tournament)
- Managed in the **Pairing Rules** tab inside the Pairings panel
- Rules with fewer than 2 players are automatically deleted

### Editing pairings after generation
The auto-generated card grid is directly editable — no mode switch needed:
- Drag players between cards
- Hover a player row → `×` to remove (player returns to unassigned)
- Unassigned players shown as draggable chips; click to select, then click a card to assign
- "Build Your Own" mode retained for building from blank groups

## Most Improved / Least Improved logic
- Qualification: `totalRounds >= 7` AND `currentYearRounds >= 3`
- `currentYearRounds` = results whose `date` starts with current calendar year
- `delta = currentPtm − beginningPtm` (positive = improved; higher PTM = better scorer)
- Non-qualified rows: amber highlight + NQ badge; top qualified = Leader badge
- No 6-point floor on display values
- Beginning-of-year snapshot stored in `cga/beginningOfYearPtm`, saved manually via BeginningPtmPanel

## PTM standings display
- PTM change after last tournament shown inline as colored arrow + whole number
- Up arrow (red) = PTM increased; down arrow (green) = PTM decreased
- No separate PTM Δ column in HDCP or Scratch tabs

## POY calculation
Defined inline in `Admin.jsx` (`calcFlightPOY`):
- Base: 350 pts for flight winner, −25 pts per rank below first
- Ties share the average of their tied positions' points
- Players marked `eligible: false` receive 0 POY points

## Key files
| File | Purpose |
|---|---|
| `src/db.js` | All Firestore read/write wrappers |
| `src/hooks/useFireData.js` | Real-time Firestore subscription hook |
| `src/pages/Admin.jsx` | Admin UI + all workflow orchestration (~4700 lines) |
| `src/pages/MostImproved.jsx` | Most/Least Improved page |
| `src/pages/Standings.jsx` | PTM standings + HDCP/Scratch tabs |
| `src/components/ui/StandingsTable.jsx` | Reusable standings table |
| `src/services/admin/publishService.js` | `buildPublishPayload()` — all publish math |
| `src/services/admin/auditService.js` | Changelog/audit payload helpers |
| `src/services/admin/snapshotService.js` | Snapshot/restore helpers |
| `src/services/admin/import/` | Bulk import: parser, planner, templates, barrel |
| `src/services/admin/validation/index.js` | All validation functions (scores, pairings, members, publish, etc.) |
| `src/exports/pdfExports.js` | PDF exports: tournament info, pairings, field roster, results, PTM |
| `src/utils/tournamentWorkflow.js` | `computeTournamentWorkflowState()` — dashboard status logic |
| `src/utils/flightOrder.js` | `FLIGHT_ORDER`, `compareFlights`, `NEW_PLAYERS_FLIGHT` |
| `src/utils/roundPtm.js` | Shared PTM rounding utility |

## Validation functions (`src/services/admin/validation/index.js`)
- `validateTournamentId` — tournament exists in schedule
- `validateMembers` — no duplicate names, PTM 0–500
- `validateUsers` — no duplicate emails, valid format
- `validateCredits` — numeric balances, known members
- `validatePayments` — valid member/tournament references
- `validateScoresForTournament` — no duplicate players, valid PTM/score
- `validatePairingsForTournament` — players exist in scores, max 4 per group
- `validatePublishPayload` — leaderboard structure, member references
- `formatValidationErrors` — first error + count summary for UI display

## Bulk import (`src/services/admin/import/`)
Supports three import types defined in `BULK_IMPORT_DEFINITIONS`: `credits`, `tournaments`, `results`. Flow: parse file → collect rows → build context → plan (add-only or replace) → apply. CSV templates downloadable via `getBulkImportTemplateDownload(importType)`.

## Styling conventions
- `forest` = dark green (primary)
- `gold` = accent/highlight
- `section-title` = serif heading utility
- `gold-divider` = section underline utility
- `stat-number` = monospace stat display
- `btn-primary` = primary button styling
- `flightTagStyles` map in Admin.jsx — flight name → Tailwind color classes
