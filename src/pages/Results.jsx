import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import { formatDateLong } from '../utils/formatDate'

export default function Results() {
  const completed = schedule.filter((t) => t.status === 'completed')

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Tournament Results</h1>
        <div className="gold-divider" />
      </div>

      {completed.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⛳</div>
          <p className="text-gray-500 font-sans text-lg">No results yet.</p>
          <p className="text-gray-600 font-sans text-sm mt-2">Check back after the first tournament on March 21.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {completed.map((t) => (
            <div key={t.id} className="bg-charcoal border border-gray-700 rounded-lg p-5 hover:border-gold transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-offwhite font-serif text-xl font-semibold mb-1">{t.name}</h2>
                  <p className="text-gray-400 font-sans text-sm">{formatDateLong(t.date)} · {t.course}</p>
                </div>
                <span className="text-xs bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full font-sans whitespace-nowrap">
                  {t.format}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
