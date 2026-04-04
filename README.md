# Carencro Golf Association (CGA) Site — 2026

Live site: **https://rbelaire.github.io/Cga/**

## Stack

- React 19 + Vite
- Tailwind CSS
- React Router (HashRouter)
- Firebase Firestore + Firebase Auth
- GitHub Pages (GitHub Actions)

## Local development

```bash
npm install
npm run dev
```

> App runs at `http://localhost:5173/Cga/` in local Vite dev.

## Environment variables

Set these in `.env.local` for local development and in GitHub Actions secrets for deploys:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAIL` (optional, defaults to `admin@cga.local`)
- `VITE_ADMIN_PIN` (optional fallback PIN)
- `VITE_ADMIN_PINS` (optional JSON map for multi-user PIN labels)

## Data flow (actual)

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

### Draft → publish behavior

- Score entry supports draft saves (`cga/scores`) before publishing.
- Publishing writes the selected tournament’s result plus recomputed season tables:
  - `cga/results`
  - `cga/standings`
  - `cga/poy`
- Other admin sections (members, credits, users, pairings, payments) save directly to their respective docs.

## Firestore structure (current implementation)

The project currently uses **flat document paths under `cga/*`** rather than `current/draft/history` namespaces.

- `cga/members` → `{ list: [...] }`
- `cga/standings` → `{ flights: {...} }`
- `cga/poy` → `{ flights: {...} }`
- `cga/ptm` → `{ list: [...] }`
- `cga/pairings` → `{ map: { [tournamentId]: [...] } }`
- `cga/payments` → `{ data: { [tournamentId]: { [member]: true } } }`
- `cga/credits` → `{ balances: { [member]: number } }`
- `cga/users` → `{ list: [...] }`
- `cga/scores` → `{ data: { [tournamentId]: { [flight]: [...] } } }`
- `cga/results` → `{ data: { [tournamentId]: resultDoc } }`
- `cga/changelog` → `{ entries: [...] }` (admin audit history)

## Results page data source

There is no standalone `Results.jsx` route in the app.

- Tournament result display is implemented in `src/pages/Tournaments.jsx`.
- It reads from Firestore (`DB.listenResults`) through `useFireData`.
- Fallback is an empty object (`{}`), so completed tournaments show “Results not yet available” until Firestore data exists.
- Legacy `/results` URL redirects to `/tournaments`.

## Admin architecture

- UI remains in `src/pages/Admin.jsx`.
- Publish computation is extracted to `src/services/admin/publishService.js`.
- Audit-entry construction is extracted to `src/services/admin/auditService.js`.
- Firestore read/write access remains centralized in `src/db.js`.

## Admin workflow UX

Admin includes an actionable workflow system:

- Quick action buttons (setup, payments, pairings, scores, users)
- Tournament workflow tracker with step actions
- “Next step” CTA based on current workflow state
- Unsaved draft detection + “Save All” orchestration

## Logging / history

Admin actions are recorded in Firestore changelog entries via `DB.appendChangelog`.

Typical entries include:

- Scores saved
- Pairings saved
- Members / credits / users / payments saved
- Results published

## Security model

- **Authentication:** Admin unlock requires PIN and also attempts Firebase Auth email/password sign-in.
- **Authorization rules:** Firestore security rules are managed in Firebase Console (no `firestore.rules` file is stored in this repo).

Recommended rule baseline for admin writes:

```text
allow write: if request.auth != null;
```

Adjust as needed for production-grade role checks.

## Key folders/files

- `src/db.js` — Firestore data-access layer
- `src/hooks/useFireData.js` — realtime subscription hook with fallback
- `src/pages/Admin.jsx` — admin UI and workflow
- `src/services/admin/` — extracted admin services
- `src/pages/Tournaments.jsx` — completed tournament results UI
- `src/pages/Standings.jsx`, `src/pages/Members.jsx`, `src/pages/Pairings.jsx` — public data pages
- `src/data/schedule.json` — season schedule metadata

## Deployment

Push to `main` triggers GitHub Actions deployment to GitHub Pages via the repository workflow.
