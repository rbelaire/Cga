# Carencro Golf Association — Website Rebuild

## Project Overview

A modern, mobile-first website for the **Carencro Golf Association (CGA)** based in Carencro/Lafayette, Louisiana. This replaces their outdated 2014 static site (carencrogolfassociation.com) with a fast, clean, dynamic web app that CGA board members can easily update.

**Built by Belaire Studio** (Ryan’s web design consultancy).

-----

## Tech Stack

- **Framework:** React 18+ with Vite
- **Styling:** Tailwind CSS 4
- **Routing:** React Router v6+
- **Hosting:** Vercel
- **Data Layer:** JSON files in `/src/data/` for now (designed to swap to Supabase or similar later)
- **No CMS yet** — phase 1 is a static data-driven site; phase 2 adds an admin panel

-----

## Design Direction

### Aesthetic: Augusta-Inspired — Clean, Premium Golf

Think Masters.com meets a modern sports site. This is NOT a generic template. It should feel like a real golf organization with heritage and pride.

- **Primary Color:** Deep forest green `#0B3D2C`
- **Secondary Color:** Rich gold/champagne `#C8A951`
- **Accent:** Warm cream/ivory `#FAF7F0`
- **Dark surfaces:** Charcoal `#1A1A1A` for cards, footers, dark sections
- **Text:** Off-white `#F5F5F0` on dark, charcoal `#2D2D2D` on light
- **Fonts:**
  - Headlines: A refined serif — try `Playfair Display` or `EB Garamond` from Google Fonts
  - Body: A clean sans — `DM Sans`, `Source Sans 3`, or `Outfit`
  - Monospace/stats: `JetBrains Mono` or `IBM Plex Mono` for leaderboard numbers

### Design Principles

1. **Mobile-first** — Golfers check this on their phones at the course. Every page must work perfectly on mobile.
1. **Data as real content** — No more screenshots of spreadsheets. All standings, results, schedules, and member data should be in actual tables/components.
1. **Minimal but polished** — Generous whitespace, strong typography hierarchy, subtle animations on scroll. Not flashy, just clean.
1. **Easy to scan** — Large type for key info (next tournament, current leader). Progressive disclosure for details.
1. **Louisiana identity** — Subtle nods to the region. Could include photography of local courses, fleur-de-lis accents, or parish references.

-----

## Site Structure & Pages

### 1. Homepage (`/`)

- Hero section with CGA name, year (2026), and a tagline or mission statement
- **Next Tournament** card — prominent countdown/date + course name + format
- Quick-access grid linking to major sections (Schedule, Standings, Results, Members)
- Latest results or news snippet
- Sponsor logo bar at bottom
- Venmo/payment CTA for dues

### 2. Tournament Schedule (`/schedule`)

- Card-based layout for each tournament
- Each card shows: date, course name, format (individual/team), entry fee, any notes
- Past tournaments greyed or collapsed; upcoming tournaments prominent
- Data lives in `/src/data/schedule.json`

### 3. Tournament Results (`/results`)

- List of completed tournaments with expandable or linked detail views
- Each result page shows: tournament name, date, course, flight winners, full leaderboard
- Data lives in `/src/data/results/` (one JSON per tournament, or a combined file)

### 4. Standings / Points (`/standings`)

- Season-long points standings table
- Columns: Rank, Player Name, Points, Events Played
- Sortable by column
- Highlight top qualifiers or current leader
- Data lives in `/src/data/standings.json`

### 5. Player of the Year (`/poy`)

- Scratch POY standings
- Handicap POY standings
- Individual Flight POY standings
- Could be tabs or separate subsections on one page

### 6. Members (`/members`)

- Searchable/filterable member directory
- Show: Name, handicap (if available), member since year
- Data lives in `/src/data/members.json`

### 7. Tournament Eligibility (`/eligibility`)

- Rules and requirements for tournament participation
- Static content page with clean typography
- Markdown or JSX content

### 8. Board Members (`/board`)

- Grid of board member cards with name, title/role, optional photo
- Data lives in `/src/data/board.json`

### 9. Sponsors (`/sponsors`)

- Sponsor tiers: Tournament & Banquet Sponsors, Trophy Sponsors
- Logo grid with links to sponsor websites
- Data lives in `/src/data/sponsors.json`

### 10. About / Bylaws (`/about`) *(optional phase 1)*

- Brief history of the CGA
- Bylaws or rules summary
- Contact info for the board

-----

## Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.jsx          # Top nav bar with CGA branding + hamburger menu on mobile
│   │   ├── Footer.jsx          # Copyright, Venmo link, social links, Belaire Studio credit
│   │   └── PageWrapper.jsx     # Consistent page padding/max-width/transitions
│   ├── ui/
│   │   ├── TournamentCard.jsx  # Reusable card for schedule items
│   │   ├── StandingsTable.jsx  # Sortable data table for standings/results
│   │   ├── MemberCard.jsx      # Member directory card
│   │   ├── SponsorLogo.jsx     # Sponsor display component
│   │   ├── CountdownTimer.jsx  # Next tournament countdown
│   │   └── SearchBar.jsx       # Reusable search/filter input
│   └── sections/
│       ├── HeroSection.jsx     # Homepage hero
│       ├── NextTournament.jsx  # Featured upcoming event
│       ├── QuickLinks.jsx      # Homepage navigation grid
│       └── SponsorBar.jsx      # Scrolling or grid sponsor logos
├── pages/
│   ├── Home.jsx
│   ├── Schedule.jsx
│   ├── Results.jsx
│   ├── Standings.jsx
│   ├── PlayerOfTheYear.jsx
│   ├── Members.jsx
│   ├── Eligibility.jsx
│   ├── Board.jsx
│   └── Sponsors.jsx
├── data/
│   ├── schedule.json
│   ├── standings.json
│   ├── results/
│   │   └── 2026-tournament-1.json
│   ├── members.json
│   ├── board.json
│   ├── sponsors.json
│   └── poy.json
├── hooks/
│   └── useSearch.js            # Reusable search/filter hook
├── utils/
│   └── formatDate.js           # Date formatting helpers
├── App.jsx
├── main.jsx
└── index.css                   # Tailwind directives + custom CSS variables
```

-----

## Data Schema Examples

### schedule.json

```json
[
  {
    "id": "2026-01",
    "name": "Season Opener",
    "date": "2026-03-21",
    "course": "Les Vieux Chenes Golf Course",
    "format": "Individual Stroke Play",
    "entryFee": 50,
    "flights": ["Championship", "A", "B", "C"],
    "status": "upcoming",
    "notes": ""
  }
]
```

### standings.json

```json
[
  {
    "rank": 1,
    "name": "John Smith",
    "points": 245,
    "eventsPlayed": 4,
    "trend": "up"
  }
]
```

### members.json

```json
[
  {
    "name": "John Smith",
    "handicap": 8.2,
    "memberSince": 2019,
    "active": true
  }
]
```

### board.json

```json
[
  {
    "name": "James Doe",
    "role": "President",
    "since": 2022,
    "photo": "/images/board/james.jpg"
  }
]
```

-----

## Key Implementation Details

### Navigation

- Desktop: Horizontal nav bar with logo left, links right
- Mobile: Hamburger menu with full-screen overlay or slide-in drawer
- Active page indicator (gold underline or highlight)
- Sticky header on scroll

### Tables & Standings

- Use a consistent `<StandingsTable>` component across all data pages
- Sortable columns (click header to sort)
- Alternating row colors for readability
- Highlight row on hover
- On mobile: horizontally scrollable if needed, or stack into cards

### Animations

- Subtle fade-in on page transitions
- Staggered card entrance on schedule/results pages
- Smooth scroll behavior
- Keep it tasteful — this isn’t a startup landing page

### SEO & Meta

- Proper `<title>` and meta description per page
- Open Graph tags for sharing
- Semantic HTML (proper heading hierarchy, landmarks)

### Performance

- Lazy load images
- Keep bundle small — no unnecessary dependencies
- JSON data is small enough to bundle; no API calls needed in phase 1

-----

## Venmo / Payment Integration

- For now, just a prominent styled link/button to `venmo.com/CGA-Pay` or the Venmo deep link
- Phase 2 could add Stripe or Square for online dues payment

-----

## Branding Assets Needed

- CGA logo (if they have one — if not, we can design a simple wordmark or monogram)
- Course photography (stock is fine for demo; real photos for production)
- Sponsor logos (collect from current site or request from board)

-----

## Phase 2 Roadmap (Future)

These are NOT part of the initial build but should be architected so they’re easy to add:

1. **Admin Panel** — Simple auth-protected dashboard for board members to update results, schedule, and standings without touching code. Could use Supabase + Row Level Security.
1. **Database Migration** — Move from JSON files to Supabase/Postgres for real-time data.
1. **Member Portal** — Login for members to view their own stats, register for tournaments.
1. **Photo Galleries** — Event photo albums with lazy-loaded image grids.
1. **Push Notifications** — Tournament reminders via email or SMS.
1. **Live Scoring** — Real-time score entry during tournaments (similar to The Classic leaderboard).
1. **Handicap Tracking** — Integration with GHIN or manual entry.

-----

## Development Commands

```bash
npm create vite@latest cga-website -- --template react
cd cga-website
npm install
npm install react-router-dom
npm install -D tailwindcss @tailwindcss/vite
npm run dev
```

-----

## Deployment

- Deploy to **Vercel** via GitHub integration
- Domain: TBD (ideally `carencrogolf.com` or similar — cleaner than the current URL)
- Vercel Analytics for traffic tracking (no Plausible/GA needed)

-----

## Credit

- Footer should include: `© 2026 Carencro Golf Association`
- Small “Built by Belaire Studio” credit in footer (linked to belairestudio.com)

-----

## Notes for Claude Code

- When generating components, always use functional components with hooks
- Use Tailwind utility classes — no separate CSS files per component
- All colors should use CSS custom properties defined in `index.css` so theming is centralized
- Prefer `clsx` or template literals for conditional class logic
- Keep components small and composable — if a component exceeds ~100 lines, break it up
- All data files should be importable JSON — use `import schedule from '../data/schedule.json'`
- Write accessible HTML: proper alt tags, aria labels on interactive elements, keyboard navigation
- Test mobile layouts at 375px width minimum
