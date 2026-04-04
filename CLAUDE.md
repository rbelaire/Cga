# Carencro Golf Association (CGA) — Project Context

## Stack
- **React 19 + Vite**, Tailwind CSS 4, React Router v7 (HashRouter)
- All data is **static JSON** in `src/data/` and `src/data/results/`
- No backend — deployed as a static site

## Routing
Uses `HashRouter` (`#/path`). Routes are defined in `src/App.jsx`.

**Main routes:**
- `/` — Home
- `/tournaments` — Schedule + Results combined (upcoming cards + completed accordion)
- `/standings` — HDCP POY / Scratch / Points to Make tabs
- `/members` — Member directory
- `/info` — Rules, Eligibility, Board tabs
- `/admin` — PIN-gated admin panel (PIN: `cga2026`)

**Legacy redirects** (→ new route): `/schedule`, `/results` → `/tournaments`; `/points-to-make` → `/standings`; `/rules`, `/board`, `/eligibility` → `/info`

## Data Files
| File | Purpose |
|------|---------|
| `src/data/schedule.json` | All tournaments for the season |
| `src/data/members.json` | Member roster with `flight`, `ptm`, `memberSince` |
| `src/data/standings.json` | Season standings by score |
| `src/data/poy.json` | Player of the Year points by flight |
| `src/data/results/2026-koasati-flow-control.json` | Tournament 2026-01 results |

## Data Field Conventions
- `points` = actual Stableford **score made** at the tournament
- `ptm` = **Points to Make** (handicap target)
- `plusMinus` = `points − ptm`
- `poy` = POY points awarded (base 350, −25/position; tied players average their slots; ineligible = 0)

## POY Points Algorithm
```
base = 350 - 25 * (zeroIndexedPosition)
tied players share averaged slots
ineligible players get poy: 0 but still hold their position in the scale
```

## Flights
`['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']`

## Adding a New Tournament
1. Add entry to `src/data/schedule.json` with `status: "upcoming"`
2. Use the admin panel (`/admin`) to enter scores and publish results to Firebase
3. Set `status: "completed"` on the tournament in `schedule.json` once done

Results are stored in Firebase (`cga/results`) and displayed automatically on `/tournaments`.

## Key Components
| Component | Notes |
|-----------|-------|
| `StandingsTable` | Sortable table; shows empty state when data is empty; `min-w-[540px]` for mobile scroll |
| `TournamentCard` | Completed cards use `bg-gray-50`; links to `/tournaments` via `state={{ expand: id }}` |
| `MemberCard` | Dims unassigned members (no `flight`/`ptm`); hides null `memberSince` |
| `Header` | Sticky, active nav item gets `bg-white/10` highlight |

## Admin Panel
- PIN gate → `<AdminPanel />`
- Left panel: searchable member pool (draggable chips)
- Right panel: flight score table (draggable rows)
- Drag interactions: pool→flight (insert), flight→flight (reorder), flight→pool (remove)
- Auto-saves to `localStorage` on every change
- Export downloads `*-results.json`, `poy.json`, `standings.json`

## Page Titles
Every page sets `document.title` via `useEffect`:
```js
useEffect(() => { document.title = 'Page Name | CGA 2026' }, [])
```

## Styling Conventions
- `forest` = dark green (primary)
- `gold` = accent/highlights/active states
- `section-title` = serif heading utility class
- `gold-divider` = gold underline divider utility class
- `stat-number` = monospace number display class
- `btn-primary` = primary button utility class
