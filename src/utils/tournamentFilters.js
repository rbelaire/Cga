function toTournamentDay(dateValue) {
  if (!dateValue) return null
  const day = new Date(`${dateValue}T00:00:00`)
  return Number.isNaN(day.getTime()) ? null : day
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function getCurrentTournaments(tournaments = [], today = startOfToday()) {
  return tournaments
    .filter(tournament => {
      const tournamentDay = toTournamentDay(tournament?.date)
      return tournamentDay && tournamentDay >= today
    })
    .sort((a, b) => toTournamentDay(a?.date) - toTournamentDay(b?.date))
}

export function getPastTournaments(tournaments = [], today = startOfToday()) {
  return tournaments
    .filter(tournament => {
      const tournamentDay = toTournamentDay(tournament?.date)
      return tournamentDay && tournamentDay < today
    })
    .sort((a, b) => toTournamentDay(b?.date) - toTournamentDay(a?.date))
}
