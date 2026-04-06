# Carencro Golf Association (CGA) Site — 2026

Live site: **https://rbelaire.github.io/Cga/**

## Project snapshot

The CGA site is a React + Firebase web app for tournament operations and member-facing updates.

- Public pages show schedule, pairings, standings, most/least improved, members, and club info.
- The admin area manages entries, payments, pairings, scores, publish, and rollback workflows.
- Firestore remains the live source of truth for operational CGA tournament data under `cga/*`.
- Firebase Auth secures the admin panel.

## Stack

- React 19 + Vite
- Tailwind CSS
- React Router v7 (HashRouter)
- Firebase Auth + Firestore + Storage utilities
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

Copy `.env.example` to `.env.local` and fill all values.

### Client SDK (required)

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### App Hosting / Next-compatible aliases (optional in this Vite app, included for cross-project parity)

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Admin SDK (for future server-side scripts)

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

### Optional admin overrides

- `VITE_ADMIN_EMAIL`
- `VITE_ADMIN_PIN`
- `VITE_ADMIN_PINS`

## Firebase architecture

### Client initialization

- `src/lib/firebase/client.js` initializes Firebase once and exports `auth`, `db`, and `storage`.
- `src/firebase.js` re-exports these for backward compatibility.

### Auth

- `/login` route supports email/password and Google sign-in.
- Protected route wrapper enforces auth for `/admin`.
- User profile docs are created/merged in Firestore `users/{uid}` with `roles` array for future role expansion.

### Firestore lightweight user collections

Typed (JSDoc) helpers are in `src/lib/firebase/firestore.js` for:

- `users`
- `savedFilters`
- `savedViews`
- `favorites`

Current user-facing usage:

- Tournaments page filter preference persistence (`savedFilters`)
- Expanded tournament view persistence (`savedViews`)
- Tournament favorites (`favorites`)

### Storage utilities

`src/lib/firebase/storage.js` includes upload-ready helpers for user-scoped paths:

- `getUserUploadRef(uid, fileName)`
- `uploadUserFile(uid, file)`

## Data flow

```text
Admin local draft state
  ├─ Save Draft / Save Pairings / Save Users / Save Payments ...
  │    -> Firestore draft-like docs (cga/scores, cga/pairings, cga/users, ...)
  └─ Publish Results
       -> Firestore live docs (cga/results, cga/standings, cga/poy)

Public pages
  -> subscribe to Firestore in real-time via useFireData()
  -> render live data when available
```

## Firestore structure

### Operational docs (`cga/*`)

- `cga/members` → `{ list: [...] }`
- `cga/standings` → `{ flights: {...} }`
- `cga/poy` → `{ flights: {...} }`
- `cga/ptm` → `{ list: [...] }`
- `cga/beginningOfYearPtm` → `{ list: [...] }` — season-start PTM snapshot for Most Improved
- `cga/pairings` → `{ map: { [tournamentId]: [...] } }`
- `cga/payments` → `{ data: { [tournamentId]: { [member]: true } } }`
- `cga/credits` → `{ balances: { [member]: number } }`
- `cga/creditTransactions` → `{ entries: [...] }`
- `cga/users` → `{ list: [...] }`
- `cga/scores` → `{ data: { [tournamentId]: { [flight]: [...] } } }`
- `cga/results` → `{ data: { [tournamentId]: resultDoc } }`
- `cga/changelog` → `{ entries: [...] }`
- `cga/snapshots` → `{ entries: [...] }`

### Lightweight user docs

- `users/{uid}` → profile + role-ready auth claims mirror
- `savedFilters/{uid_page}` → user filters per page
- `savedViews/{uid_page}` → user UI preferences per page
- `favorites/{uid_entityType_entityId}` → favorites metadata

## Security rules

Starter rules are included:

- `firestore.rules`
- `storage.rules`
- `firebase.json`

These default to conservative user ownership for the new user-scoped collections.

## Deployment notes

### Existing deployment

Pushes to `main` deploy to GitHub Pages through the repo workflow.

### Firebase App Hosting readiness

This repository includes Firebase config/rules and environment naming parity (`NEXT_PUBLIC_*`) so the project can be adapted for Firebase App Hosting later without reworking app-level Firebase modules.

General flow when moving to App Hosting:

1. Create/attach Firebase project.
2. Set env variables in App Hosting backend.
3. Deploy Firestore/Storage rules (`firebase deploy --only firestore:rules,storage`).
4. Configure build/start commands for the chosen runtime.

## Additional documentation

- [`BOARD_OVERVIEW.md`](./BOARD_OVERVIEW.md) — stakeholder summary
- [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) — practical admin operating guide
- [`PITCH.md`](./PITCH.md) — value proposition / replacement story
- [`CLAUDE.md`](./CLAUDE.md) — internal engineering context
