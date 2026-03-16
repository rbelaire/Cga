import PageWrapper from '../components/layout/PageWrapper'

export default function Eligibility() {
  return (
    <PageWrapper className="max-w-3xl">
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Tournament Eligibility</h1>
        <div className="gold-divider" />
      </div>

      <div className="prose-cga space-y-8">
        <Section title="Membership Requirement">
          <p>
            All participants must be active, dues-paid members of the Carencro Golf Association for the current season.
            Annual dues of <strong className="text-darktext">$75</strong> must be paid prior to competing in any CGA
            tournament. Dues can be paid via Venmo{' '}
            <a href="https://venmo.com/CGA-Pay" target="_blank" rel="noopener noreferrer" className="text-forest underline hover:text-gold transition-colors">
              @CGA-Pay
            </a>
            .
          </p>
        </Section>

        <Section title="Handicap Requirements">
          <ul className="list-disc pl-5 space-y-2">
            <li>An official USGA/WHS handicap index is strongly recommended but not required for all flights.</li>
            <li>Players without an official handicap may be placed at the discretion of the Tournament Director.</li>
            <li>Handicap must be established prior to the first tournament to be eligible for Handicap POY.</li>
            <li>Sandbaggers may be reclassified by the Tournament Director at any time.</li>
          </ul>
        </Section>

        <Section title="Flight Assignments">
          <p>Flights are assigned based on USGA handicap index at the start of the season:</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-forest text-offwhite">
                  <th className="px-4 py-2 text-left font-sans font-semibold">Flight</th>
                  <th className="px-4 py-2 text-left font-sans font-semibold">Handicap Range</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Championship', '+5 to 5'],
                  ['A Flight', '6 to 12'],
                  ['B Flight', '13 to 18'],
                  ['C Flight', '19 and above'],
                ].map(([flight, range], i) => (
                  <tr key={flight} className={i % 2 === 0 ? 'bg-gray-100' : 'bg-white'}>
                    <td className="px-4 py-2 font-sans font-medium text-forest">{flight}</td>
                    <td className="px-4 py-2 font-sans text-gray-600 stat-number">{range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Points System">
          <p className="mb-3">Points are awarded per flight based on finish position:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-forest text-offwhite">
                  <th className="px-4 py-2 text-left font-sans font-semibold">Place</th>
                  <th className="px-4 py-2 text-left font-sans font-semibold">Points</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['1st', '75'],
                  ['2nd', '60'],
                  ['3rd', '50'],
                  ['4th', '40'],
                  ['5th', '35'],
                  ['6th–10th', '25'],
                  ['Participant', '10'],
                ].map(([place, pts], i) => (
                  <tr key={place} className={i % 2 === 0 ? 'bg-gray-100' : 'bg-white'}>
                    <td className="px-4 py-2 font-sans text-gray-700">{place}</td>
                    <td className="px-4 py-2 font-sans font-medium text-forest stat-number">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="General Rules">
          <ul className="list-disc pl-5 space-y-2">
            <li>USGA Rules of Golf apply to all CGA tournaments unless modified by local rules posted at the course.</li>
            <li>Tee times must be honored. Players arriving more than 10 minutes late forfeit their spot.</li>
            <li>All disputes must be submitted to the Tournament Director before the scorecard is signed.</li>
            <li>The Tournament Director's decision on all rules disputes is final.</li>
            <li>Pace of play: Groups must maintain pace. Slow play may result in disqualification at the Tournament Director's discretion.</li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            For eligibility questions, contact Tournament Director{' '}
            <strong className="text-darktext">Marcus Thibodaux</strong> or any board member.
          </p>
        </Section>
      </div>
    </PageWrapper>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-xl font-serif font-semibold text-forest mb-1">{title}</h2>
      <div className="w-10 h-0.5 bg-gold mb-3" />
      <div className="text-gray-600 font-sans leading-relaxed text-sm">{children}</div>
    </div>
  )
}
