# Carencro Golf Association — 2026 Season Site

Live site: **https://rbelaire.github.io/Cga/**

---

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + Vite 8 |
| Styling | Tailwind CSS 3 |
| Routing | React Router v7 (HashRouter) |
| Database | Firebase Firestore |
| Hosting | GitHub Pages (via GitHub Actions) |

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file (never committed)
cp .env.example .env.local
# Fill in the Firebase values from the Firebase console

# 3. Start dev server
npm run dev
# → http://localhost:5173/Cga/
```

---

## Environment variables

All six Firebase config values must be set before the app connects to the database.

| Variable | Where to find it |
|----------|-----------------|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps → Web app |
| `VITE_FIREBASE_AUTH_DOMAIN` | same |
| `VITE_FIREBASE_PROJECT_ID` | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | same |
| `VITE_FIREBASE_APP_ID` | same |

**For local dev:** put them in `.env.local`

**For GitHub Pages deploys:** add them as repository secrets at  
`Settings → Secrets and variables → Actions → New repository secret`

---

## Deployment

Pushes to `main` automatically build and deploy via `.github/workflows/deploy.yml`.  
The workflow injects the Firebase secrets as env vars during `npm run build`.

---

## Admin panel

URL: `/#/admin` — PIN-gated (`cga2026`)

| Tab | What it does |
|-----|-------------|
| **Score Entry** | Enter player scores per flight for a tournament. **Save Draft** saves work-in-progress to Firestore. **Publish Results** calculates standings and POY and makes them live instantly. |
| **Pairings Builder** | Auto-generate or manually build tee-time groups. **Save Pairings** pushes to Firestore. |
| **Flight Management** | Assign each member to a flight and set their PTM. **Save to Cloud** publishes immediately. |
| **Credit on Books** | Track member credit balances. **Save to Cloud** persists to Firestore. |

PDF exports (results, pairings, points-to-make, credits) are available in every tab for printing.

---

## Data flow

```
Admin panel  →  Firestore  →  Live site (real-time)
                    ↑
            Static JSON files (instant first-load fallback)
```

Public pages subscribe to Firestore on load. They show the static JSON bundled at build time immediately, then switch to live Firestore data the moment it arrives. No page reload needed when the admin saves.

---

## Firestore structure

| Path | Contents |
|------|---------|
| `cga/members` | `{ list: [...] }` — full member roster |
| `cga/standings` | `{ flights: { ... } }` — season standings by flight |
| `cga/poy` | `{ flights: { ... } }` — Player of the Year points |
| `cga/pairings` | `{ map: { [tournamentId]: [...] } }` — tee-time pairings |
| `cga/credits` | `{ balances: { [name]: amount } }` — credit balances |
| `cga/scores` | `{ data: { [tid]: { [flight]: [...] } } }` — admin score drafts |
| `cga/results/{tid}` | Full result document for one tournament |

---

## Adding a new tournament

1. Add the tournament to `src/data/schedule.json`
2. Enter scores in the Admin panel → Score Entry
3. Click **Publish Results** — standings, POY, and the result document are written to Firestore and go live immediately
4. If the Results page should show a leaderboard, also add a static import in `src/pages/Results.jsx` and map the tournament id (the Results page currently reads from static JSON imports)

---

## Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cga/{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

Public reads are open. Writes are only possible from the Firebase console or a trusted server — the admin panel writes using the SDK with the API key, which is fine for this use case since the PIN gates access.

---

## Key source files

| File | Purpose |
|------|---------|
| `src/firebase.js` | Firebase app init |
| `src/db.js` | All Firestore read/write functions |
| `src/hooks/useFireData.js` | React hook for live Firestore subscriptions with static fallback |
| `src/pages/Admin.jsx` | Full admin panel |
| `src/pages/Results.jsx` | Tournament results viewer |
| `src/pages/Standings.jsx` | Season standings |
| `src/pages/PointsToMake.jsx` | PTM table for all members |
| `src/data/` | Static JSON (bundled at build time, used as fallback) |
