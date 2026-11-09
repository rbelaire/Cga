# Carencro Golf Association site

Live site: https://rbelaire.github.io/Cga/

React + Firebase site for the public schedule and for board members running an event.

- Public pages: schedule, pairings, standings, members, rules, sponsors.
- Admin: a step-by-step event flow (field, flights, pairings, scores, review, publish) plus roster, accounts, downloads, and history.
- Firestore documents stay compatible with the current live data. No migration.
- GitHub Pages serves the production build from `/Cga/`. Routes use `HashRouter`.

## Commands

```bash
npm install
npm run dev          # live Firestore, http://localhost:5173/#/
npm run dev:seed     # practice admin, no live writes, http://localhost:5174/#/admin
npm test
npm run lint
npm run build        # output in out/
```

CI runs lint, tests, and the production build on pull requests to `main`.

## Environment

Copy `.env.example` to `.env.local` and set the `VITE_FIREBASE_*` client keys. Practice mode is `npm run dev:seed` (`VITE_DATA_BACKEND=seed`). Do not set that flag for a production build.

Sign-in is email/password or Google. Admin access is the owner account, an admin row in `cga/users`, or `users/{uid}.roles` containing `admin`. An empty user list does not make every signed-in person an admin.

## Data

Public reads: `cga/members`, `cga/standings`, `cga/poy`, `cga/ptm`, `cga/beginningOfYearPtm`, `cga/tournamentStatus`, `cgaResults`, `cgaPairings`, `cgaLifecycle`.

Admin writes those plus `cgaScores`, `cgaPayments`, `cgaPaymentMeta`, `cga/credits`, `cga/users`, `cga/pairingRules`, and snapshots. New log entries go to `cgaChangelog` and `cgaCreditTx` when the rules allow it, and otherwise append to the existing `cga/changelog` and `cga/creditTransactions` arrays (kept to the latest 200). Publishing adds this event onto the season totals. It does not replace the season with one event.

`firestore.rules` in this repo matches that split. It is not deployed by CI. Deploy it separately when the board is ready. Until then, the app still works with the rules that are already live.

See `CLAUDE.md` for the engineering map.
