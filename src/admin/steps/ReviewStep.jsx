import { buildPublish } from '../../domain/publish'
import { playersIn } from '../roster'
import { useClub } from '../useClub'
import { formatName } from '../../utils/formatName'
import { Help, Notice, Panel } from '../ui'

export default function ReviewStep({ event }) {
  const club = useClub()
  if (!club.ready) return <Notice>Loading the review…</Notice>
  const field = playersIn(club.scores[event.id])
  const missing = field.filter((row) => !row.wd && (row.score === '' || row.score == null))
  const groups = club.pairings[event.id] || []
  const preview = field.length ? buildPublish({
    tournament: event,
    scoreData: club.scores[event.id],
    standings: club.standings,
    poy: club.poy,
    members: club.members,
    ptmList: club.ptm,
    previousResult: club.results[event.id] || null,
  }) : null

  return (
    <div className="space-y-4">
      <Help>Read this before publishing. Season points are added to what players already have. Players who sat out keep their points. Publishing again replaces this event’s earlier points instead of adding them twice.</Help>
      <Panel title="Checklist">
        <ul className="text-sm space-y-1">
          <li>{field.length} players in the field, {Object.keys(club.payments[event.id] || {}).length} marked paid.</li>
          <li>{groups.length} pairing groups.</li>
          <li>{missing.length ? `${missing.length} players still need a score.` : 'Every player has a score or a WD.'}</li>
          <li>{club.results[event.id] ? 'This event was published before. A new publish updates it.' : 'This event has not been published.'}</li>
        </ul>
      </Panel>
      {!preview ? <Notice>There is nothing to preview until the field has players and scores.</Notice> : (
        <Panel title="What the public leaderboard will show">
          {Object.entries(preview.resultDoc.leaderboard).map(([flight, rows]) => (
            <div key={flight} className="mb-3">
              <h3 className="font-heading font-semibold text-forest">{flight}</h3>
              <ul className="text-sm">
                {rows.map((row) => <li key={row.name}>{row.wd ? 'WD' : row.rank}. {formatName(row.name)} · score {row.points} · {row.poy} POY</li>)}
              </ul>
            </div>
          ))}
        </Panel>
      )}
    </div>
  )
}
