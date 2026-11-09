/** CSV with group and player (or name) columns. */
export function parsePairingsCsv(text, knownNames = null) {
  const lines = String(text || '').trim().split(/\r?\n/)
  if (lines.length < 2) return { error: 'The file needs a header row and at least one group.' }
  const headers = lines[0].split(',').map((cell) => cell.trim().replace(/^"|"$/g, '').toLowerCase())
  const groupIdx = headers.indexOf('group')
  const playerIdx = headers.findIndex((cell) => cell === 'player' || cell === 'name')
  if (groupIdx === -1 || playerIdx === -1) return { error: 'The file needs "group" and "player" columns.' }
  const groups = new Map()
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
    const group = cols[groupIdx] || ''
    const player = cols[playerIdx] || ''
    if (!group || !player) continue
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(player)
  }
  if (!groups.size) return { error: 'No groups were found.' }
  const unknown = []
  const pairings = [...groups.entries()].map(([label, names], index) => ({
    pairing: /^\d+$/.test(label) ? `Pairing ${label}` : label || `Pairing ${index + 1}`,
    players: names.map((name) => {
      if (knownNames && !knownNames.has(name)) unknown.push(name)
      return { name, flight: '' }
    }),
  }))
  return { pairings, unknown }
}

/** Accept a Firestore pairings doc, a legacy bare array, or nothing. */
export function normalizePairings(raw) {
  if (!raw) return { pairings: [], tournament: '', source: '' }
  if (Array.isArray(raw)) {
    return { pairings: raw.filter(Boolean), tournament: '', source: '' }
  }
  const pairings = Array.isArray(raw.pairings) ? raw.pairings.filter(Boolean) : []
  return {
    pairings,
    tournament: raw.tournament || '',
    source: raw.source || '',
  }
}

export function pairingGroups(raw) {
  return normalizePairings(raw).pairings
}

/**
 * Build groups of at most 4. Always-together rules are seated first.
 * Remaining players are spread across flights. Never-together is best-effort.
 */
export function generatePairings(players = [], rules = []) {
  const roster = players.filter((player) => player?.name)
  if (!roster.length) return []

  const byName = Object.fromEntries(roster.map((player) => [player.name, player]))
  const groupCount = Math.ceil(roster.length / 4)
  const groups = Array.from({ length: groupCount }, () => [])
  const seated = new Set()

  let seed = 0
  for (const rule of rules.filter((item) => item?.type === 'always')) {
    const names = (rule.players || []).filter((name) => byName[name] && !seated.has(name)).slice(0, 4)
    if (names.length < 2) continue
    while (seed < groupCount && groups[seed].length >= 4) seed += 1
    if (seed >= groupCount) break
    for (const name of names) {
      groups[seed].push(byName[name])
      seated.add(name)
    }
    seed += 1
  }

  const queues = []
  const flights = []
  for (const player of roster) {
    if (seated.has(player.name)) continue
    if (!flights.includes(player.flight)) flights.push(player.flight || 'Unassigned')
  }
  for (const flight of flights) {
    const queue = roster.filter((player) => (player.flight || 'Unassigned') === flight && !seated.has(player.name))
    if (queue.length) queues.push(queue)
  }

  let index = 0
  while (index < groupCount && groups[index].length >= 4) index += 1
  let guard = 0
  while (queues.some((queue) => queue.length) && guard < roster.length * 3) {
    guard += 1
    const group = groups[index] || groups[0]
    const represented = new Set(group.map((player) => player.flight))
    const preferred = queues.find((queue) => queue.length && !represented.has(queue[0].flight))
    const queue = preferred || queues.find((item) => item.length)
    if (!queue || !group) break
    group.push(queue.shift())
    if (group.length >= 4) {
      index = (index + 1) % groupCount
      let checked = 0
      while (groups[index].length >= 4 && checked < groupCount) {
        index = (index + 1) % groupCount
        checked += 1
      }
    }
  }

  for (const rule of rules.filter((item) => item?.type === 'never')) {
    const ruleSet = new Set(rule.players || [])
    for (let from = 0; from < groups.length; from += 1) {
      const offenders = groups[from].filter((player) => ruleSet.has(player.name))
      for (let i = 1; i < offenders.length; i += 1) {
        const moving = offenders[i]
        const target = groups.findIndex((group, gi) => (
          gi !== from && group.length < 4 && !group.some((player) => ruleSet.has(player.name))
        ))
        if (target === -1) continue
        groups[from] = groups[from].filter((player) => player !== moving)
        groups[target] = [...groups[target], moving]
      }
    }
  }

  return groups
    .filter((group) => group.length)
    .map((group, i) => ({ pairing: `Pairing ${i + 1}`, players: group }))
}
