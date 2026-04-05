# Carencro Golf Association (CGA) Site — 2026

Live site: **https://rbelaire.github.io/Cga/**

## Project snapshot

The CGA site is a React + Firebase web app for tournament operations and member-facing updates.

- Public pages show schedule, pairings, standings, members, and club info.
- The admin area manages entries, payments, pairings, scores, publish, and rollback workflows.
- Firestore is the live source of truth for all operational data.

## Stack

- React 19 + Vite
- Tailwind CSS
- React Router (HashRouter)
- Firebase Firestore + Firebase Auth
- GitHub Pages (GitHub Actions deploy)

## Local development

```bash
npm install
npm run dev
```

Run tests:

```bash
npm test
```

Build production bundle:

```bash
npm run build
```

> App runs at `http://localhost:5173/Cga/` in local Vite dev.

## Environment variables

Set these in `.env.local` for local dev and in GitHub Actions secrets for deployments:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAIL` (optional, defaults to `admin@cga.local`)
- `VITE_ADMIN_PIN` (optional fallback PIN)
- `VITE_ADMIN_PINS` (optional JSON map for multi-user PIN labels)

## Data flow

```text
Admin local draft state (localStorage)
  ├─ Save Draft / Save Pairings / Save Users / Save Payments ...
  │    -> Firestore draft-like docs (cga/scores, cga/pairings, cga/users, ...)
  └─ Publish Results
       -> Firestore live docs (cga/results, cga/standings, cga/poy)

Public pages
  -> subscribe to Firestore in real-time via useFireData()
  -> render live data when available
```

## Firestore structure (current implementation)

The app currently uses **flat document paths under `cga/*`**.

- `cga/members` → `{ list: [...] }`
- `cga/standings` → `{ flights: {...} }`
- `cga/poy` → `{ flights: {...} }`
- `cga/ptm` → `{ list: [...] }`
- `cga/pairings` → `{ map: { [tournamentId]: [...] } }`
- `cga/payments` → `{ data: { [tournamentId]: { [member]: true } } }`
- `cga/credits` → `{ balances: { [member]: number } }`
- `cga/creditTransactions` → `{ entries: [{ member, amount, date, note?, reference?, source? }] }`
- `cga/users` → `{ list: [...] }`
- `cga/scores` → `{ data: { [tournamentId]: { [flight]: [...] } } }`
- `cga/results` → `{ data: { [tournamentId]: resultDoc } }`
- `cga/changelog` → `{ entries: [...] }`
- `cga/snapshots` → `{ entries: [{ id, type, ts, tid?, details, data }] }`

## Admin safety model

Admin saves and publish flow through validators in `src/services/admin/validation/`.

Guardrails include:
- tournament ID validity,
- duplicate member/user detection,
- invalid score/PTM values,
- malformed credits/payments structures,
- pairing references to unknown players,
- publish payload completeness/member references.

Invalid writes are blocked and surfaced as admin error banners.

## Snapshots and restore

Before key writes, the app captures rollback snapshots for:
- `scores`, `pairings`, `members`, `credits`, `payments`, `users`,
- publish-sensitive docs: `results` (per tournament), `standings`, `poy`.

From the **Snapshots** admin tab, admins can restore with explicit confirmation. Restore actions are written to changelog history.

## Bulk Import (Admin)

The Admin area now includes a **Bulk Import** tab for safe spreadsheet imports.

- Supported import types: **Credits**, **Tournaments**, **Results**.
- Accepted file formats: **.xlsx** and **.csv**.
- Dry run is required before apply and reports:
  - rows detected,
  - valid/invalid rows,
  - rows to add,
  - duplicates skipped,
  - conflicts and blocking validation errors.
- Default mode is **add-only** (no overwrite / no silent replacement).
- Duplicate matching is conservative:
  - Credits: `member + date + amount + note + reference`
  - Tournaments: `tournamentId`
  - Results: `tournamentId + flight + member`
- Before apply, the app snapshots affected docs; after apply it logs a changelog entry.
- Templates are downloadable directly in the Bulk Import panel (`cga-credits-template.csv`, `cga-tournaments-template.csv`, `cga-results-template.csv`).

## Routing notes

- Tournament result rendering is in `src/pages/Tournaments.jsx`.
- There is no standalone `Results.jsx` route.
- Legacy `/results` URL redirects to `/tournaments`.

## Key files

- `src/db.js` — Firestore data-access layer
- `src/hooks/useFireData.js` — realtime subscription hook
- `src/pages/Admin.jsx` — admin UI/workflow
- `src/services/admin/` — publish, audit, validation services
- `src/pages/Tournaments.jsx` — completed tournament results UI
- `src/data/schedule.json` — season schedule metadata

## Deployment

Pushes to `main` deploy to GitHub Pages through the repo workflow.

## Additional documentation

- [`BOARD_OVERVIEW.md`](./BOARD_OVERVIEW.md) — stakeholder summary
- [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) — practical admin operating guide
- [`PITCH.md`](./PITCH.md) — value proposition / replacement story
- [`CLAUDE.md`](./CLAUDE.md) — internal engineering context
