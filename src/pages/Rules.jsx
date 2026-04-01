import { useEffect } from 'react'
import PageWrapper from '../components/layout/PageWrapper'

// ── Data ─────────────────────────────────────────────────────────────────────

const sections = [
  {
    id: 'scoring',
    title: 'Scoring System',
    items: [
      {
        heading: 'General',
        bullets: [
          'Points (Stableford) system is used for scoring.',
          'Players are instructed to pick up on the hole once no points can be made.',
          'Points are totalled after the round is completed.',
        ],
      },
    ],
  },
  {
    id: 'handicap',
    title: 'Handicap & Points to Make (PTM)',
    items: [
      {
        heading: 'How PTM Is Calculated',
        bullets: [
          'Round 1 — A player\'s first round is played to post a score on the books. They are not included in flights and do not participate in prize winnings. PTM is set to the score shot in this round.',
          'Round 2 — Played on the "Bubble." Player participates in prize winnings. PTM is the score from Round 1. Player is limited to +2 of their PTM, but can score below PTM by any amount.',
          'Round 3 — Also played on the "Bubble." PTM is the best of the first 2 scores.',
          'Rounds 4–7 — PTM is determined by dropping the lowest score and averaging the remaining ones.',
          'Round 8+ — PTM is determined by dropping the lowest two scores and averaging the remaining five.',
          'A player\'s last 7 rounds are recorded at any time.',
          'Minimum PTM for any player is 6.',
        ],
      },
      {
        heading: 'Tee Categories & PTM Adjustment',
        bullets: [
          'Three tee categories exist: Regular (Black), Senior (Blue, age 55+), Super Senior (Red, age 68+).',
          'Age qualification is based on the player\'s age prior to the first tournament of the year.',
          'Moving to shorter tees is voluntary and must be indicated on the annual membership renewal form.',
          'When a player moves up a tee category, their PTM is increased by 2 to compensate for the shorter distance.',
        ],
      },
    ],
  },
  {
    id: 'poy',
    title: 'Player of the Year (POY) Points',
    items: [
      {
        heading: 'Scratch POY',
        bullets: [
          'The Scratch Player of the Year is the player who accumulates the highest points total throughout the year.',
          'All members are eligible for the Scratch Player of the Year.',
        ],
      },
      {
        heading: 'Handicap POY — Points Scale',
        bullets: [
          '1st place = 350 points',
          '2nd place = 325 points',
          '3rd place = 300 points',
          '4th place = 275 points',
          'Each subsequent place drops by 25 points.',
          'Points are allocated based on each player\'s standing (+/− to PTM) within their flight.',
        ],
      },
      {
        heading: 'Ties',
        bullets: [
          'When players tie, the points for all tied positions are added together, averaged, and awarded to each tied player.',
          'Example — 2 players tie for 1st: (350 + 325) ÷ 2 = 337.5 each; 2nd place then earns 300.',
          'Example — 3 players tie for 2nd: (325 + 300 + 275) ÷ 3 = 300 each; 3rd place then earns 250.',
        ],
      },
      {
        heading: 'Ineligible (NQ) Players',
        bullets: [
          'To qualify for Handicap POY points, a member must have 7 recorded rounds.',
          'Players who are NOT yet qualified still affect the flight standings as placeholders.',
          'Their score is recorded and the place they would have earned is passed over — those points are not awarded.',
          'This keeps the points distribution fair regardless of how many NQ players are in a given flight.',
        ],
      },
    ],
  },
  {
    id: 'eligibility',
    title: 'Championship Tournament Eligibility',
    items: [
      {
        heading: 'Scratch Champion',
        bullets: [
          'A member must have at least 3 credited rounds during the year to qualify.',
          'An out-of-town tournament counts as 2 credited rounds.',
          'Winner is the player with the lowest total score for both days.',
        ],
      },
      {
        heading: 'Handicap Champion',
        bullets: [
          'All members with a minimum of 7 scores on record AND 3 or more credited rounds this year are eligible, including 1st-year players.',
          'Winner is the player with the best points total (both days) in relation to PTM.',
        ],
      },
      {
        heading: 'Scratch Player of the Year',
        bullets: [
          'All members are eligible.',
          'Winner is the player with the most overall points made during the year.',
        ],
      },
      {
        heading: 'Handicap Player of the Year',
        bullets: [
          'A player must have a minimum of 7 scores on record to qualify.',
          'No POY points are awarded until this criteria is met.',
          'Winner is the player with the most POY points at year-end.',
        ],
      },
    ],
  },
  {
    id: 'awards',
    title: 'Annual Awards',
    items: [
      {
        heading: 'Awards presented at year-end',
        bullets: [
          'Scratch Champion — Presented for all 3 categories (Regular, Senior, Super Senior). Winner is the player with the highest 2-day points total in the Championship (End of Year) Tournament.',
          'Handicap Champion — Winner is the player with the best 2-day comparison to PTM in the Championship Tournament.',
          'Scratch Player of the Year — Winner is the player with the highest points total for the year.',
          'Handicap Player of the Year — Winner is the player with the most POY points for the year.',
        ],
      },
    ],
  },
  {
    id: 'most-improved',
    title: 'Most & Least Improved',
    items: [
      {
        heading: 'Qualification & Calculation',
        bullets: [
          'To qualify, a player must have a minimum of 7 rounds played total and 3 in the current year.',
          'A player\'s current PTM is compared to their beginning-of-year PTM. The resulting +/− determines standing.',
          'Players who are not qualified are highlighted on the standings list. The highest non-highlighted player is the leader.',
          'If a player has fewer than 6 PTM, the 6-point minimum does not apply here — actual beginning and YTD PTM are displayed.',
        ],
      },
    ],
  },
  {
    id: 'rainout',
    title: 'Rainout Tournaments',
    items: [
      {
        heading: 'Policy',
        bullets: [
          'In the event of a rained-out tournament round, credit for a round played is given to all entrants who show up at the course ready to play by the tee time.',
          'The round does not count toward Championship Tournament Eligibility.',
        ],
      },
    ],
  },
  {
    id: 'on-course',
    title: 'On-Course Rules',
    items: [
      {
        heading: 'Ball Movement — General',
        bullets: [
          'You are allowed to move the ball one club length, no closer to the hole.',
          'You may move your ball from the rough to the fairway, or from the fairway to the rough.',
          'You cannot move your ball once it is on the green.',
          'You cannot move your ball from the fringe onto the green, or from the green onto the fringe.',
          'Putt all putts out.',
        ],
      },
      {
        heading: 'Water Hazards',
        bullets: [
          'You cannot move your ball if it is touching any water in a water hazard, whether the hazard is marked or unmarked.',
          'You cannot move your ball if the body of water has receded due to drought — the edge of the water bank is the defining line.',
          'You may hit your ball out of a water hazard without moving the ball.',
          'Casual water as defined by the USGA Rules of Golf is the only water from which you may move your ball.',
        ],
      },
      {
        heading: 'Sand Bunkers',
        bullets: [
          'You cannot move your ball in a sand bunker.',
          'The only time a ball may be touched in a sand bunker is if the board deems it unplayable prior to the round.',
        ],
      },
      {
        heading: 'Out of Bounds',
        bullets: [
          'We play everything lateral except OB.',
          'CGA allows the OB rule: you may drop in the fairway with a 2-stroke penalty.',
          'This rule was added to improve pace of play.',
        ],
      },
      {
        heading: 'Unmarked Hazards',
        bullets: [
          'If your ball is in an unmarked hazard — such as native grass, bushes, or a heavy tree line — you may move your ball one club length.',
          'This does NOT apply to sand bunkers or water hazards.',
          'If the hazard is marked, you cannot move your ball, but you may still hit from within the hazard.',
        ],
      },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Rules() {
  useEffect(() => { document.title = 'Rules | CGA 2026' }, [])

  return (
    <PageWrapper className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">CGA Rules &amp; Policies</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm max-w-xl leading-relaxed">
          The Carencro Golf Association was formed in the 1980s and the board is committed to following
          and enforcing these rules and policies during all tournaments.
        </p>
      </div>

      {/* Quick-nav */}
      <nav className="flex flex-wrap gap-2 mb-8">
        {sections.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="px-3 py-1.5 text-xs font-sans font-medium rounded-full bg-white border border-gray-200 text-forest hover:bg-gold hover:text-white hover:border-gold transition-colors"
          >
            {s.title}
          </a>
        ))}
      </nav>

      {/* Sections */}
      <div className="space-y-6 mb-10">
        {sections.map(section => (
          <div
            key={section.id}
            id={section.id}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden scroll-mt-20"
          >
            {/* Section header */}
            <div className="bg-forest px-5 py-3">
              <h2 className="text-white font-serif text-lg font-semibold">{section.title}</h2>
            </div>

            {/* Sub-sections */}
            <div className="divide-y divide-gray-100">
              {section.items.map((item, idx) => (
                <div key={idx} className="px-5 py-4">
                  {item.heading && (
                    <h3 className="font-serif text-forest text-sm font-semibold mb-2">{item.heading}</h3>
                  )}
                  <ul className="space-y-1.5">
                    {item.bullets.map((line, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                        <span className="text-gray-600 font-sans text-sm leading-relaxed">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Contact footer */}
      <div className="bg-forest rounded-lg px-6 py-5 text-center">
        <p className="text-offwhite font-serif text-lg font-semibold mb-1">Questions about the rules?</p>
        <p className="text-gray-300 font-sans text-sm">
          Feel free to reach out to any board member or send us an email.
        </p>
      </div>
    </PageWrapper>
  )
}
