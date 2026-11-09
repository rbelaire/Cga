# Carencro Golf Association — engineering context

## Architecture
React 19 + Vite, Tailwind, React Router v7 (`HashRouter`). Firebase Auth + Cloud Firestore. Static JSON for the schedule, board, and sponsors. Build output is `out/` (`npm run build`). Dev base is `/`. Production base is `/Cga/`.

`npm run dev:seed` sets `VITE_DATA_BACKEND=seed` and uses an in-memory club. It never writes live Firestore.

## Routes
Defined in `src/App.jsx`.

- `/` home
- `/tournaments` and `/tournaments/:tournamentId`
- `/standings` (handicap, scratch, points to make, most/least improved)
- `/pairings/:tournamentId`
- `/members`, `/info`, `/sponsors`, `/login`
- `/admin` event steps (`?event=&step=`), `/admin/roster`, `/admin/people`, `/admin/exports`, `/admin/history`

Legacy redirects: `/schedule` and `/results` → tournaments; `/points-to-make`, `/poy`, `/most-improved` → standings; `/rules`, `/board`, `/eligibility` → info.

An error boundary remounts when the route changes.

## Firestore (unchanged documents)
`cga/members` `{ list }`, `cga/standings` `{ flights }` (public handicap points are `poy`), `cga/poy` `{ flights }` (field `points`), `cga/ptm` `{ list }`, `cga/beginningOfYearPtm`, `cga/credits` `{ balances }`, `cga/users` `{ list, adminEmails }`, `cga/changelog` `{ entries }`, `cga/creditTransactions` `{ entries }`, `cga/tournamentStatus` `{ completed }`, `cga/pairingRules` `{ rules }`.

Per event: `cgaResults/{tid}`, `cgaScores/{tid}`, `cgaPairings/{tid}` (`{ pairings, tournament, source }` or a legacy array), `cgaPayments/{tid}`, `cgaPaymentMeta/{tid}`, `cgaLifecycle/{tid}`.

`cgaSnapshots` are individual documents. New log lines prefer `cgaChangelog` / `cgaCreditTx` and fall back to the legacy arrays (latest 200) if the rules reject the new collections.

Saves go straight to Firestore after the first snapshot arrives. There is no localStorage draft.

## Scoring
- POY: 350 for the flight winner, −25 per place, ties share the average, `eligible: false` gets 0. Eligibility is 7 rounds. Ranking uses the true plus/minus. A player with lifetime `rounds` of 1 or 2 displays at most +2.
- PTM from the last 7 scores: 1 score → that score; 2 → the higher; 3–6 → drop the low and average; 7 → drop the two low scores and average the rest. Floor is 6.
- Publishing adds this event’s points onto the season and, on a republish, subtracts the previous result for that event first. Players who did not play stay. `cga/ptm` is updated because the public points tab reads it.
- Most improved: `currentPtm - beginningPtm`, qualified at 7 total rounds and 3 rounds whose result date is this calendar year.
- A past calendar date, a static `completed` status, or `tournamentStatus.completed[id]` marks an event finished. The next event is the first one still upcoming. Countdown dates are local calendar dates.

## Admin
`src/admin/AdminApp.jsx` is the shell. Steps live in `src/admin/steps/`. Club listeners live in `ClubProvider.jsx`. Publish math is `src/domain/publish.js`. Pairing shape and generation are `src/domain/pairings.js`.

Access: owner email, or a loaded `cga/users` row with role `admin` and status not `disabled`. The rules file also accepts `users/{uid}.roles` and `cga/users.adminEmails`. An empty list is not a bootstrap admin. Rules in the repo are not deployed by the app.

## Checks
`npm test` covers PTM, POY accumulation, the provisional display cap, pairings shape, schedule status, snapshots, and the workflow checklist. `npm run lint` is part of CI.
