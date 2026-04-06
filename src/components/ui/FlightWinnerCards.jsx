export default function FlightWinnerCards({ winners = [], className = '' }) {
  if (!winners.length) return null

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 ${className}`}>
      {winners.map((winner) => (
        <div key={winner.flight} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">
          <p className="text-forest text-[11px] font-sans font-semibold uppercase tracking-wide mb-1">
            {winner.flight}
          </p>
          <div className="space-y-1">
            {winner.players.map((player) => (
              <div key={`${winner.flight}-${player.name}`} className="leading-tight space-y-0.5">
                <p className="text-darktext font-sans text-sm font-semibold">{player.name}</p>
                {player.pending ? (
                  <p className="text-gray-600 text-xs font-sans">Results pending</p>
                ) : (
                  <>
                    <p className="text-darktext font-sans text-2xl font-extrabold tracking-tight">{player.score}</p>
                    {player.relative && (
                      <p className="text-gray-700 text-[11px] font-sans font-medium">{player.relative}</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
