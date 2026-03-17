import PageWrapper from '../components/layout/PageWrapper'
import SponsorLogo from '../components/ui/SponsorLogo'
import sponsors from '../data/sponsors.json'

function SponsorTier({ title, description, sponsors: list }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-serif font-semibold text-forest mb-1">{title}</h2>
      <div className="w-10 h-0.5 bg-gold mb-2" />
      {description && <p className="text-gray-500 font-sans text-sm mb-4">{description}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {list.map((s) => (
          <SponsorLogo key={s.name} sponsor={s} />
        ))}
      </div>
    </div>
  )
}

export default function Sponsors() {
  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">2026 Sponsors</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm max-w-xl">
          The Carencro Golf Association is grateful for the generous support of our sponsors who make each season possible.
        </p>
      </div>

      <SponsorTier
        title="Tournament & Banquet Sponsors"
        description="Premier sponsors supporting tournament events and our annual banquet."
        sponsors={[...sponsors.tournament, ...sponsors.banquet]}
      />

      <SponsorTier
        title="Trophy Sponsors"
        description="Local businesses sponsoring trophies and awards for our flight winners."
        sponsors={sponsors.trophy}
      />

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <h3 className="text-darktext font-serif text-lg font-semibold mb-2">Interested in Sponsoring?</h3>
        <p className="text-gray-500 font-sans text-sm mb-4">
          Contact a board member to learn about sponsorship opportunities for the 2026 season.
        </p>
      </div>
    </PageWrapper>
  )
}
