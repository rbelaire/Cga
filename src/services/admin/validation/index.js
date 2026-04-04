const SCORE_FLIGHTS_DEFAULT = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight', 'New Players']

function hasText(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function normalizeName(v) {
  return String(v ?? '').trim().toLowerCase()
}

function isFiniteNumber(v) {
  if (v === '' || v == null) return false
  const n = Number(v)
  return Number.isFinite(n)
}

function collectDuplicateNames(list = [], getName = item => item?.name) {
  const seen = new Map()
  const duplicates = new Set()
  list.forEach(item => {
    const key = normalizeName(getName(item))
    if (!key) return
    if (seen.has(key)) duplicates.add(String(getName(item)).trim())
    else seen.set(key, true)
  })
  return [...duplicates]
}

export function validateTournamentId(targetTid, schedule = []) {
  if (!hasText(targetTid)) return ['Tournament ID is required.']
  if (!schedule.some(t => t.id === targetTid)) return [`Tournament ID "${targetTid}" was not found in schedule.`]
  return []
}

export function validateMembers(list = []) {
  const errors = []
  const duplicates = collectDuplicateNames(list)
  if (duplicates.length) errors.push(`Duplicate member names: ${duplicates.join(', ')}`)

  list.forEach((member, idx) => {
    if (!hasText(member?.name)) errors.push(`Member row ${idx + 1} is missing name.`)
    if (member?.ptm != null && member.ptm !== '' && (!isFiniteNumber(member.ptm) || Number(member.ptm) < 0 || Number(member.ptm) > 500)) {
      errors.push(`Invalid PTM for ${member?.name || `member row ${idx + 1}`}.`)
    }
  })
  return errors
}

export function validateUsers(list = []) {
  const errors = []
  const emailSeen = new Set()
  list.forEach((user, idx) => {
    const label = user?.name || `user row ${idx + 1}`
    if (!hasText(user?.name)) errors.push(`Missing user name at row ${idx + 1}.`)
    const email = String(user?.email ?? '').trim().toLowerCase()
    if (!email) {
      errors.push(`Missing email for ${label}.`)
    } else {
      if (emailSeen.has(email)) errors.push(`Duplicate user email: ${email}`)
      emailSeen.add(email)
      if (!email.includes('@')) errors.push(`Invalid email for ${label}.`)
    }
  })
  return errors
}

export function validateCredits(credits = {}, memberNames = []) {
  const errors = []
  const nameSet = new Set(memberNames.map(normalizeName))
  for (const [name, value] of Object.entries(credits)) {
    if (!isFiniteNumber(value)) errors.push(`Credit balance for ${name} must be a valid number.`)
    if (!nameSet.has(normalizeName(name))) errors.push(`Credit entry references unknown member: ${name}.`)
  }
  return errors
}

export function validatePayments(payments = {}, schedule = [], memberNames = []) {
  const errors = []
  const memberSet = new Set(memberNames.map(normalizeName))
  const scheduleIds = new Set(schedule.map(t => t.id))
  for (const [tid, paymentMap] of Object.entries(payments)) {
    if (!scheduleIds.has(tid)) errors.push(`Payments include unknown tournament ID: ${tid}.`)
    if (!paymentMap || typeof paymentMap !== 'object' || Array.isArray(paymentMap)) {
      errors.push(`Payments for ${tid} must be an object map.`)
      continue
    }
    for (const [memberName, paid] of Object.entries(paymentMap)) {
      if (paid !== true) errors.push(`Payments value for ${memberName} in ${tid} must be true.`)
      if (!memberSet.has(normalizeName(memberName))) errors.push(`Payment references unknown member: ${memberName}.`)
    }
  }
  return errors
}

export function validateScoresForTournament({ tournamentId, scoresByTournament = {}, scoreFlights = SCORE_FLIGHTS_DEFAULT }) {
  const errors = []
  const tournamentScores = scoresByTournament?.[tournamentId] ?? {}
  const seen = new Set()

  scoreFlights.forEach(flight => {
    const rows = tournamentScores?.[flight] ?? []
    rows.forEach((row, idx) => {
      const name = String(row?.name ?? '').trim()
      const rowLabel = `${flight} row ${idx + 1}`
      if (!name) {
        errors.push(`${rowLabel} is missing player name.`)
        return
      }
      const key = normalizeName(name)
      if (seen.has(key)) errors.push(`Duplicate player in tournament scores: ${name}.`)
      seen.add(key)

      if (row?.ptm != null && row.ptm !== '' && (!isFiniteNumber(row.ptm) || Number(row.ptm) < 0 || Number(row.ptm) > 500)) {
        errors.push(`Invalid PTM for ${name}.`)
      }
      if (row?.score !== '' && row?.score != null && !isFiniteNumber(row.score)) {
        errors.push(`Invalid score for ${name}.`)
      }
    })
  })

  return errors
}

export function validatePairingsForTournament({ tournamentId, pairingsByTournament = {}, scoresByTournament = {} }) {
  const errors = []
  const pairings = pairingsByTournament?.[tournamentId] ?? []
  const scoreNames = new Set(
    Object.values(scoresByTournament?.[tournamentId] ?? {})
      .flatMap(rows => (rows ?? []).map(r => normalizeName(r?.name)))
      .filter(Boolean),
  )

  pairings.forEach((group, idx) => {
    const groupName = group?.pairing || `Pairing ${idx + 1}`
    const players = Array.isArray(group?.players) ? group.players : []
    if (players.length > 4) errors.push(`${groupName} has more than 4 players.`)
    players.forEach(player => {
      if (!scoreNames.has(normalizeName(player?.name))) {
        errors.push(`${groupName} references player not in score entry: ${player?.name || 'Unknown'}.`)
      }
    })
  })

  return errors
}

export function validatePublishPayload(payload, { members = [], scoreFlights = SCORE_FLIGHTS_DEFAULT } = {}) {
  const errors = []
  if (!payload?.targetTid) errors.push('Missing tournament ID for publish.')
  if (!payload?.resultDoc) errors.push('Publish payload is missing result document.')
  if (!payload?.newStandings?.flights) errors.push('Publish payload is missing standings.')
  if (!payload?.newPoy?.flights) errors.push('Publish payload is missing POY standings.')

  const memberSet = new Set((members || []).map(m => normalizeName(m.name)))

  for (const flight of scoreFlights.filter(f => f !== 'New Players')) {
    const rows = payload?.resultDoc?.leaderboard?.[flight] ?? []
    rows.forEach((row, idx) => {
      if (!hasText(row?.name)) errors.push(`${flight} leaderboard row ${idx + 1} is missing name.`)
      if (!isFiniteNumber(row?.points)) errors.push(`Invalid score points for ${row?.name || `${flight} row ${idx + 1}`}.`)
      if (!isFiniteNumber(row?.ptm)) errors.push(`Invalid PTM for ${row?.name || `${flight} row ${idx + 1}`}.`)
      if (!memberSet.has(normalizeName(row?.name))) errors.push(`Publish references unknown member: ${row?.name || `${flight} row ${idx + 1}`}.`)
    })
  }

  return errors
}

export function formatValidationErrors(errors = []) {
  const unique = [...new Set(errors)].filter(Boolean)
  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return `${unique[0]} (+${unique.length - 1} more)`
}
