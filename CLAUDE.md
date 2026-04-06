# Carencro Golf Association (CGA) — Engineering Context

## Current architecture
- **React 19 + Vite**, Tailwind CSS, React Router v7 (HashRouter)
- **Firebase Firestore + Firebase Auth** back end for live and admin data
- Static JSON retained for baseline site metadata (e.g., schedule, board, sponsors)

## Routing
Uses `HashRouter` (`#/path`). Routes are defined in `src/App.jsx`.

**Main routes:**
- `/` — Home
- `/tournaments` — schedule cards + completed results view
- `/tournaments/:tournamentId` — tournament detail
- `/standings` — PTM standings + HDCP/Scratch POY displays
- `/most-improved` — Most / Least Improved page (PTM delta from season start)
- `/pairings/:tournamentId` — member pairings
- `/members` — member directory
- `/info` — rules, eligibility, board tabs
- `/sponsors` — sponsor directory
- `/login` — Firebase Auth login
- `/admin` — auth-gated admin panel (lazy-loaded)

**Legacy redirects** (→ new route):
- `/schedule`, `/results` → `/tournaments`
- `/points-to-make`, `/poy` → `/standings`
- `/rules`, `/board`, `/eligibility` → `/info`

## Data sources
### Static data (`src/data/`)
- `schedule.json` — season tournament metadata
- `board.json` — board page content
- `sponsors.json` — sponsor content

### Firestore live/admin data (`cga/*`)
- `members`, `standings`, `poy`, `ptm`, `beginningOfYearPtm`, `pairings`, `payments`, `credits`, `users`, `scores`, `results`, `changelog`, `snapshots`

Public views subscribe to Firestore using `useFireData` and gracefully fall back when data is unavailable.

## Admin behavior
- Firebase Auth gate for admin unlock (email/password or Google)
- `adminMode` string drives which panel is visible; nav grid buttons set it
- Draft-like save flows for operational data entry; `dirtyRegistry` tracks unsaved sections
- Publish computes and writes `results`, `standings`, and `poy`
- Validation layer in `src/services/admin/validation/` blocks invalid writes
- Snapshot and restore support for operational recovery
- Changelog entries written for key actions
- Exports panel is a proper `adminMode` (not a modal)
- BeginningPtmPanel allows admins to snapshot PTM at season start for Most Improved calculations

## Most Improved / Least Improved logic
- Qualification: `totalRounds >= 7` AND `currentYearRounds >= 3`
- `currentYearRounds` counted from completed results whose `date` starts with the current calendar year
- `delta = currentPtm − beginningPtm` (positive = improved; higher PTM = better scorer)
- Non-qualified rows highlighted amber + NQ badge; top qualified = Leader badge
- No 6-point floor applied to display values
- Beginning-of-year PTM snapshot stored in `cga/beginningOfYearPtm` and saved manually by admin via BeginningPtmPanel

## PTM standings display
- PTM change after last tournament shown inline as colored arrow + whole number next to the PTM value
- Up arrow (red) = PTM increased; down arrow (green) = PTM decreased
- No separate PTM Δ column in HDCP or Scratch standings tabs

## Key files
- `src/db.js` — Firestore read/write wrappers
- `src/hooks/useFireData.js` — real-time subscription hook
- `src/pages/Admin.jsx` — admin UI + workflow orchestration
- `src/pages/MostImproved.jsx` — Most/Least Improved page
- `src/pages/Standings.jsx` — PTM standings + HDCP/Scratch tabs
- `src/components/ui/StandingsTable.jsx` — reusable standings table (HDCP/Scratch tabs)
- `src/services/admin/publishService.js` — publish computations
- `src/services/admin/auditService.js` — audit/changelog payload helpers
- `src/services/admin/snapshotService.js` — snapshot/restore helpers
- `src/utils/roundPtm.js` — shared PTM rounding utility

## Styling conventions
- `forest` = dark green (primary)
- `gold` = accent/highlight
- `section-title` = serif heading utility
- `gold-divider` = section underline utility
- `stat-number` = monospace stat display
- `btn-primary` = primary button styling
