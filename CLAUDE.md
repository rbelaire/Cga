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
- `/standings` — standings + POY displays
- `/pairings` — member pairings
- `/members` — member directory
- `/info` — rules, eligibility, board tabs
- `/admin` — PIN-gated admin panel

**Legacy redirects** (→ new route):
- `/schedule`, `/results` → `/tournaments`
- `/points-to-make` → `/standings`
- `/rules`, `/board`, `/eligibility` → `/info`

## Data sources
### Static data (`src/data/`)
- `schedule.json` — season tournament metadata
- `board.json` — board page content
- `sponsors.json` — sponsor content

### Firestore live/admin data (`cga/*`)
- `members`, `standings`, `poy`, `ptm`, `pairings`, `payments`, `credits`, `users`, `scores`, `results`, `changelog`, `snapshots`

Public views subscribe to Firestore using `useFireData` and gracefully fall back when data is unavailable.

## Admin behavior
- PIN gate + auth attempt for admin unlock
- Draft-like save flows for operational data entry
- Publish computes and writes `results`, `standings`, and `poy`
- Validation layer in `src/services/admin/validation/` blocks invalid writes
- Snapshot and restore support for operational recovery
- Changelog entries written for key actions

## Key files
- `src/db.js` — Firestore read/write wrappers
- `src/hooks/useFireData.js` — real-time subscription hook
- `src/pages/Admin.jsx` — admin UI + workflow orchestration
- `src/services/admin/publishService.js` — publish computations
- `src/services/admin/auditService.js` — audit/changelog payload helpers
- `src/services/admin/snapshotService.js` — snapshot/restore helpers

## Styling conventions
- `forest` = dark green (primary)
- `gold` = accent/highlight
- `section-title` = serif heading utility
- `gold-divider` = section underline utility
- `stat-number` = monospace stat display
- `btn-primary` = primary button styling
