import PageWrapper from '../components/layout/PageWrapper'
import board from '../data/board.json'

export default function Board() {
  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="section-title text-3xl sm:text-4xl">Board Members</h1>
        <div className="gold-divider" />
        <p className="text-gray-600 font-sans text-sm">
          The CGA board is composed of volunteer members who organize and run the association.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {board.map((member) => {
          const initials = member.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)

          return (
            <div
              key={member.name}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gold hover:shadow-sm transition-colors"
            >
              <div className="flex items-center gap-4 mb-4">
                {member.photo ? (
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-gold"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-forest border-2 border-gold flex items-center justify-center flex-shrink-0">
                    <span className="text-gold font-serif font-bold text-lg">{initials}</span>
                  </div>
                )}
                <div>
                  <p className="text-darktext font-serif text-lg font-semibold leading-tight">{member.name}</p>
                  <p className="text-gold text-xs font-sans font-semibold uppercase tracking-wide mt-0.5">
                    {member.role}
                  </p>
                </div>
              </div>
              <p className="text-gray-500 text-xs font-sans">
                Serving since {member.since}
              </p>
            </div>
          )
        })}
      </div>
    </PageWrapper>
  )
}
