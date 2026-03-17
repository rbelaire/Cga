# Carencro Golf Association — Website Rebuild

## Project Overview

A modern, mobile-first website for the **Carencro Golf Association (CGA)** based in Carencro/Lafayette, Louisiana. This replaces their outdated 2014 static site (carencrogolfassociation.com) with a fast, clean, easy-to-read web app.

**Built by Belaire Studio.**

---

## Tech Stack

- **Framework:** React 18+ with Vite
- **Styling:** Tailwind CSS 4
- **Routing:** React Router v6+
- **Hosting:** Vercel
- **Data Layer:** JSON files in `/src/data/` (designed to swap to Supabase later)
- **No CMS yet** — phase 1 is static data-driven; phase 2 adds admin panel

---

## Design Direction

### THE SINGLE MOST IMPORTANT THING

This site is for **older men in a local golf association**. They want to check the schedule, see standings, and find tournament info. That's it. Every design decision should prioritize **readability, simplicity, and ease of navigation**. We are not selling anything. We are not impressing VCs. We are making information easy to find and easy to read.

### Aesthetic: Clean, Light, Breathable — Like a Well-Kept Scorecard

Think of a clean printed tournament program or a country club bulletin board — not a tech startup landing page.

### Color Palette

- **Background:** White `#FFFFFF` and very light warm gray `#F8F7F4` for alternating sections
- **Primary (headers, nav, footer):** Deep navy blue `#0F2A4A` — classic, authoritative, golf-traditional
- **Accent:** Muted gold `#C8A951` — used SPARINGLY for highlights, active states, and small accents only
- **Text primary:** Dark charcoal `#2D2D2D` on light backgrounds
- **Text secondary:** Medium gray `#6B7280` for supporting info (dates, labels)
- **Text on navy:** White `#FFFFFF` or cream `#FAF7F0`
- **Borders/dividers:** Light gray `#E5E7EB` — subtle, not heavy
- **Table rows:** Alternate between white and `#F9FAFB` — never dark backgrounds for data
- **Success/trend up:** Muted green `#16A34A`

### What NOT to Do

- **NO dark charcoal cards or dark card backgrounds** — keep everything light and airy
- **NO dark-on-dark sections** — standings tables, quick links, and content sections should be on WHITE or very light backgrounds
- **NO heavy visual density** — generous whitespace everywhere
- **NO trendy gradients, glass effects, or complex animations**
- **NO small text** — minimum 16px body text, 14px for labels/captions
- **NO information overload on any single screen** — if it scrolls more than 3-4 phone screens, break it up
- **NO selling or marketing language** — this is informational, like a notice board

### Typography

- **Headlines:** `Playfair Display` (serif) — used only for page titles and the CGA name. Keep it elegant but restrained.
- **Everything else:** `DM Sans` or `Source Sans 3` (sans-serif) — clean, highly readable at all sizes
- **Table numbers/stats:** Same sans-serif font, just use font-weight and size for hierarchy
- **Size scale:**
  - Page titles: 28-32px
  - Section headers: 22-24px
  - Body text: 16-18px
  - Labels/captions: 14px minimum
  - Table data: 16px minimum

### Layout Principles

1. **WHITE SPACE IS THE DESIGN.** Let content breathe. Padding should feel generous, not cramped.
2. **Light backgrounds dominate.** The only dark areas are the top nav bar and the footer. Everything in between is white or near-white.
3. **One-column on mobile.** No side-by-side cards that are too small to tap. Stack everything vertically on phones.
4. **Big tap targets.** Navigation links and buttons should be large and easy to press with a thumb.
5. **Clear visual hierarchy.** A person should be able to glance at any page and immediately know what they're looking at and where to go next.
6. **Minimal decoration.** A thin gold underline on a section heading is enough accent. Don't over-style.

---

## Site Structure & Pages

### 1. Homepage (`/`)

The homepage is a **simple dashboard** — not a marketing page. It answers three questions:
1. When is the next tournament?
2. Who's leading the standings?
3. Where do I go for more info?

**Layout (top to bottom):**

- **Nav bar** (navy background, white text, CGA logo left, hamburger right on mobile)
- **Hero area** — Clean white/light background. CGA name + "2026 Season" + one-line tagline: "Bringing Acadiana's finest golfers together since 2000." NO hero image needed. Keep it simple.
- **Next Tournament block** — White card with light border. Tournament name large, date + course underneath, format and entry fee as small pills/badges. Countdown timer (days, hours, mins) in navy text. "Full schedule →" link below.
- **Quick Access grid** — 2-column grid on mobile, 3-column on desktop. Simple white cards with light gray border, icon + label. Links to: Tournament Schedule, Season Standings, Tournament Results, Player of the Year, Member Directory, Eligibility Rules. Icons should be simple line icons (Lucide or similar), muted gray color. NO dark card backgrounds.
- **Top 5 Standings preview** — Simple table on white background. Rank, Player, Points, Events columns. Gold highlight on #1. "Full standings →" link.
- **Dues callout** — Light section (cream/warm gray bg). "2026 Dues — $75" with Venmo button. Simple, not pushy.
- **Sponsor bar** — Small section, sponsor names as text pills/tags on light background. "View all →" link.
- **Footer** — Navy background. CGA logo + name + location. Quick links column. Pay dues link. "Built by Belaire Studio" credit.

### 2. Tournament Schedule (`/schedule`)
- Page title: "2026 Tournament Schedule"
- Simple list/card layout — each tournament is a white card with light border
- Each card shows: Date (large), Tournament Name (bold), Course, Format, Entry Fee
- Past tournaments visually muted (lighter text, "Completed" badge)
- Upcoming tournaments prominent
- NO complex timeline or calendar view — just a clean list

### 3. Tournament Results (`/results`)
- Page title: "Tournament Results"
- List of completed tournaments — click/tap to expand or navigate to detail
- Each result shows: Tournament Name, Date, Course, Winner(s) by flight
- Detail view: Full leaderboard table — Rank, Player, Score, Flight
- White background, clean table with alternating light gray rows

### 4. Standings (`/standings`)
- Page title: "2026 Season Standings"
- Full standings table — Rank, Player Name, Points, Events Played
- Sortable columns (click header)
- Top 3 highlighted with subtle gold accent (left border or rank color)
- White background, alternating rows `#FFFFFF` / `#F9FAFB`

### 5. Player of the Year (`/poy`)
- Page title: "Player of the Year"
- Tabs or sections for: Scratch POY, Handicap POY, Individual Flight POY
- Each is a simple standings table
- Same table styling as standings page

### 6. Members (`/members`)
- Page title: "Member Directory"
- Search bar at top
- Simple list or table: Name, Handicap, Member Since
- Alphabetical by default
- White background, clean rows

### 7. Eligibility (`/eligibility`)
- Page title: "Tournament Eligibility"
- Clean prose — well-spaced paragraphs on white background
- Use clear section headings if multiple rules categories
- No fancy formatting needed — just readable text

### 8. Board Members (`/board`)
- Page title: "Board Members"
- Simple grid of cards — Name, Title/Role
- Optional photo (placeholder silhouette if none)
- White cards, minimal styling

### 9. Sponsors (`/sponsors`)
- Page title: "2026 CGA Sponsors"
- Grouped by tier: Tournament & Banquet Sponsors, Trophy Sponsors
- Sponsor names as clean cards or a simple list with links
- If logos available, show them. If not, text names in styled pills are fine.

---

## Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.jsx          # Navy nav bar — CGA logo left, hamburger menu right (mobile), text links (desktop)
│   │   ├── Footer.jsx          # Navy footer — CGA info, quick links, Venmo, Belaire Studio credit
│   │   ├── MobileMenu.jsx      # Full-screen or slide-in menu overlay — large tap targets, well-spaced links
│   │   └── PageWrapper.jsx     # Consistent max-width (1024px), padding, page title treatment
│   ├── ui/
│   │   ├── DataTable.jsx       # Reusable table — white bg, alternating rows, sortable headers, responsive
│   │   ├── TournamentCard.jsx  # White card with border — date, name, course, format, fee
│   │   ├── QuickLinkCard.jsx   # White card with icon + label — for homepage grid
│   │   ├── CountdownTimer.jsx  # Days/Hours/Mins display — navy text on white, not flashy
│   │   ├── SponsorPill.jsx     # Rounded pill with sponsor name — light border, subtle
│   │   ├── Badge.jsx           # Small pill for "Shotgun", "$75", "Completed" etc.
│   │   ├── SearchBar.jsx       # Simple input with icon — for member directory
│   │   └── SectionHeader.jsx   # Page/section title with optional gold underline accent
│   └── sections/
│       ├── NextTournament.jsx  # Homepage next event block
│       ├── QuickAccess.jsx     # Homepage navigation grid
│       ├── StandingsPreview.jsx # Homepage top-5 standings
│       ├── DuesCallout.jsx     # Dues amount + Venmo link
│       └── SponsorBar.jsx      # Sponsor names row/grid
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
│   └── useSearch.js
├── utils/
│   └── formatDate.js
├── App.jsx
├── main.jsx
└── index.css                   # Tailwind directives + CSS custom properties
```

---

## Data Schema Examples

### schedule.json
```json
[
  {
    "id": "2026-01",
    "name": "Hargrove Roofing Open",
    "date": "2026-04-19",
    "course": "Contraband Bayou Golf Club",
    "format": "Shotgun / Stroke Play",
    "entryFee": 75,
    "flights": ["Championship", "A", "B", "C"],
    "status": "upcoming",
    "notes": ""
  }
]
```

### standings.json
```json
[
  { "rank": 1, "name": "Myron Lane", "points": 36, "eventsPlayed": 1, "trend": "up" },
  { "rank": 2, "name": "Richard Bourgeois", "points": 34, "eventsPlayed": 1, "trend": "up" },
  { "rank": 3, "name": "Brett Myhand", "points": 34, "eventsPlayed": 1, "trend": "up" },
  { "rank": 4, "name": "Alan Chasteen", "points": 33, "eventsPlayed": 1, "trend": "up" },
  { "rank": 5, "name": "Ralph Jordan", "points": 33, "eventsPlayed": 1, "trend": "up" }
]
```

### sponsors.json
```json
{
  "tournamentAndBanquet": [
    { "name": "Acadiana Chevrolet", "url": "" },
    { "name": "Lafayette General Health", "url": "" },
    { "name": "Bayou Brewing Co.", "url": "" },
    { "name": "Broussard & Associates Law", "url": "" },
    { "name": "Prejean's Restaurant", "url": "" },
    { "name": "Olde Tyme Grocery", "url": "" }
  ],
  "trophy": [
    { "name": "Hebert's Trophy & Awards", "url": "" },
    { "name": "Carencro True Value Hardware", "url": "" },
    { "name": "Fontenot Printing", "url": "" }
  ]
}
```

### members.json
```json
[
  { "name": "Myron Lane", "handicap": 8.2, "memberSince": 2019, "active": true }
]
```

### board.json
```json
[
  { "name": "James Doe", "role": "President", "since": 2022, "photo": "" }
]
```

---

## CSS Custom Properties (index.css)

```css
@import "tailwindcss";

:root {
  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8F7F4;
  --bg-table-alt: #F9FAFB;
  --bg-navy: #0F2A4A;

  /* Text */
  --text-primary: #2D2D2D;
  --text-secondary: #6B7280;
  --text-on-dark: #FFFFFF;
  --text-on-dark-muted: #CBD5E1;

  /* Accents */
  --accent-gold: #C8A951;
  --accent-green: #16A34A;

  /* Borders */
  --border-light: #E5E7EB;
  --border-medium: #D1D5DB;
}
```

---

## Key UI Rules — READ THESE CAREFULLY

1. **The page background is always WHITE or warm light gray (`#F8F7F4`).** Dark sections are ONLY the nav and footer.
2. **Cards are WHITE with a 1px light gray border (`#E5E7EB`).** Never dark backgrounds for content cards.
3. **Tables have alternating white / `#F9FAFB` rows.** Header row can be navy with white text or light gray with dark text. No dark table bodies.
4. **Quick Access / navigation cards are WHITE with light borders and muted gray icons.** Not dark charcoal boxes.
5. **Gold accent is used only for:** thin underlines on section headers, the #1 rank highlight, active nav indicator, and CTA buttons. That's it.
6. **Buttons:** Primary CTA (Venmo, etc.) = gold background `#C8A951` with dark text. Secondary = navy outline. Keep them large (min 44px height for mobile tap targets).
7. **Mobile menu:** When hamburger is tapped, show a clean full-screen overlay or slide-in with large, well-spaced links (at least 48px line height per link). Easy for big fingers.
8. **No parallax, no scroll animations, no hover effects beyond subtle color changes.** Keep it dead simple.
9. **Every page gets a consistent treatment:** Navy nav bar at top → white/light content area → navy footer. Consistent max-width container (1024px) with comfortable side padding (20-24px on mobile).
10. **Images are optional.** The site works perfectly with zero photos. If course photos are added later, they're supplementary, not structural.

---

## Navigation Structure

**Desktop nav (left to right):**
CGA Logo | Home | Schedule | Standings | Results | POY | Members | More ▾ (Board, Sponsors, Eligibility)

**Mobile nav (hamburger menu):**
- Home
- Tournament Schedule
- Season Standings
- Tournament Results
- Player of the Year
- Member Directory
- Board Members
- Sponsors
- Eligibility Rules
- ──────
- Pay Dues (Venmo link)

---

## Venmo Integration

- Venmo handle: `@CGA-Pay`
- Link: `https://venmo.com/CGA-Pay`
- Displayed in: Homepage dues callout, footer, mobile menu
- Annual dues: $75

---

## Deployment

- Deploy to **Vercel** via GitHub integration
- Domain: TBD
- Vercel Analytics enabled

---

## Footer Content

```
Carencro Golf Association
CARENCRO, LOUISIANA
Bringing golfers together in the heart of Acadiana since 2000.

QUICK LINKS          PAY DUES
Home                 2026 annual dues are $75.
Tournament Schedule  Pay securely via Venmo.
Season Standings     [Pay on Venmo →]
Results
Eligibility Rules

─────────────────────────────
© 2026 Carencro Golf Association. All rights reserved.
Built by Belaire Studio
```

---

## Phase 2 Roadmap (NOT part of initial build)

1. Admin Panel — Board members update results/schedule via simple dashboard
2. Database Migration — JSON → Supabase/Postgres
3. Member Portal — Login, personal stats, tournament registration
4. Photo Galleries — Event photos
5. Live Scoring — Real-time score entry during tournaments
6. Email/SMS Reminders — Tournament notifications

---

## Development Commands

```bash
npm create vite@latest cga-website -- --template react
cd cga-website
npm install
npm install react-router-dom
npm install -D tailwindcss @tailwindcss/vite
npm run dev
```

---

## Notes for Claude Code

- Functional components with hooks only
- Tailwind utility classes — no separate CSS files per component
- All colors via CSS custom properties in `index.css`
- Use `clsx` or template literals for conditional classes
- Keep components under 100 lines — break up if larger
- Import JSON data directly: `import schedule from '../data/schedule.json'`
- Accessible HTML: alt tags, aria labels, keyboard navigation
- Test mobile layouts at 375px width minimum
- **REMEMBER: Light, white, breathable. If a section feels dark or heavy, it's wrong.**
