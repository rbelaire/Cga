import { useEffect } from 'react'
import sponsors from '../data/sponsors.json'
import PageWrapper from '../components/layout/PageWrapper'

const GROUPS = [
  ['tournament', 'Tournament sponsors'],
  ['banquet', 'Banquet sponsors'],
  ['trophy', 'Trophy sponsors'],
]

export default function Sponsors() {
  useEffect(() => { document.title = 'Sponsors | CGA 2026' }, [])
  return (
    <PageWrapper>
      <h1 className="section-title">Sponsors</h1>
      <div className="gold-divider" />
      <div className="space-y-8">
        {GROUPS.map(([key, title]) => (
          <section key={key}>
            <h2 className="font-heading font-bold text-xl text-forest mb-3">{title}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(sponsors[key] || []).map((sponsor) => (
                <li key={sponsor.name} className="bg-white border border-[#E5E0D4] rounded-xl p-4 font-heading font-semibold text-forest">
                  {sponsor.url ? <a href={sponsor.url} className="underline" target="_blank" rel="noreferrer">{sponsor.name}</a> : sponsor.name}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageWrapper>
  )
}
