export const FIELD_CAP = 120

export function playersIn(scoreDoc) {
  const rows = []
  for (const [flight, list] of Object.entries(scoreDoc || {})) {
    for (const row of list || []) {
      if (row?.name) rows.push({ ...row, flight })
    }
  }
  return rows
}

export function withoutPlayer(scoreDoc, name) {
  const next = {}
  for (const [flight, list] of Object.entries(scoreDoc || {})) {
    const rows = (list || []).filter((row) => row?.name !== name)
    if (rows.length) next[flight] = rows
  }
  return next
}

export function withPlayer(scoreDoc, flight, row) {
  const next = withoutPlayer(scoreDoc, row.name)
  next[flight] = [...(next[flight] || []), row]
  return next
}

export function playerRow(member) {
  return {
    name: member.name,
    ptm: member.ptm ?? '',
    score: '',
    eligible: true,
    rounds: typeof member.rounds === 'number' ? member.rounds : (member.history || []).length,
    wd: false,
  }
}
