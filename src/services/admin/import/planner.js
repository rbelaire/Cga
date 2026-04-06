import { BULK_IMPORT_DEFINITIONS } from './templates.js'

const FLIGHT_ALIASES = {
  championship: 'Championship',
  '1stflight': '1st Flight',
  '2ndflight': '2nd Flight',
  '3rdflight': '3rd Flight',
  '4thflight': '4th Flight',
  '5thflight': '5th Flight',
  newplayers: 'New Players',
}

function toText(value) {
  return String(value ?? '').trim()
}

function normalizeKey(value) {
  return toText(value).toLowerCase()
}

function normalizeDate(value) {
  const text = toText(value)
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function toAmount(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function toNumber(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeFlight(value) {
  const raw = toText(value)
  if (!raw) return null
  const key = raw.replace(/\s+/g, '').toLowerCase()
  return FLIGHT_ALIASES[key] ?? raw
}

function rowIssue(rowNumber, issue, suggestion = null) {
  return { rowNumber, issue, suggestion }
}

function buildSummary(plan) {
  return {
    rowsDetected: plan.rowsDetected,
    validRows: plan.validRows,
    invalidRows: plan.invalidRows,
    toAdd: plan.toAdd.length,
    duplicates: plan.duplicates.length,
    conflicts: plan.conflicts.length,
    updates: 0,
    blockingErrors: plan.issues.length,
  }
}

function basePlan(importType, mode) {
  return {
    importType,
    mode,
    rowsDetected: 0,
    validRows: 0,
    invalidRows: 0,
    issues: [],
    toAdd: [],
    duplicates: [],
    conflicts: [],
  }
}

function detectRequiredColumns(rows = [], requiredColumns = []) {
  const present = new Set(rows.flatMap(({ row }) => Object.keys(row ?? {}).map(normalizeKey)))
  return requiredColumns.filter(col => !present.has(normalizeKey(col)))
}

export function planBulkImport({ importType, mode = 'add-only', rows = [], context }) {
  if (mode !== 'add-only') {
    throw new Error('Only add-only mode is currently enabled for safety.')
  }
  if (!BULK_IMPORT_DEFINITIONS[importType]) {
    throw new Error(`Unsupported import type: ${importType}`)
  }

  const missingColumns = detectRequiredColumns(rows, BULK_IMPORT_DEFINITIONS[importType].requiredColumns)
  if (missingColumns.length > 0) {
    return {
      ...basePlan(importType, mode),
      rowsDetected: rows.length,
      invalidRows: rows.length,
      issues: [rowIssue(1, `Missing required columns: ${missingColumns.join(', ')}`, 'Download and use the latest template to match required headers.')],
      summary: {
        rowsDetected: rows.length,
        validRows: 0,
        invalidRows: rows.length,
        toAdd: 0,
        duplicates: 0,
        conflicts: 0,
        updates: 0,
        blockingErrors: 1,
      },
    }
  }

  if (importType === 'credits') return planCreditsImport(rows, context, mode)
  if (importType === 'tournaments') return planTournamentImport(rows, context, mode)
  return planResultsImport(rows, context, mode)
}

function planCreditsImport(rows, context, mode) {
  const plan = basePlan('credits', mode)
  const memberLookup = context.memberLookup
  const existingKeys = new Set(context.creditTransactionKeys)
  const fileKeys = new Set()

  plan.rowsDetected = rows.length
  rows.forEach(({ rowNumber, row }) => {
    const memberName = toText(row.member)
    const amount = toAmount(row.amount)
    const date = normalizeDate(row.date)
    const note = toText(row.note)
    const reference = toText(row.reference)
    const memberKey = normalizeKey(memberName)

    if (!memberName || amount == null || !date) {
      plan.invalidRows += 1
      plan.issues.push(rowIssue(rowNumber, 'Missing required values (member, amount, date).', 'Fill every required field using the template column names.'))
      return
    }
    if (!memberLookup.has(memberKey)) {
      plan.invalidRows += 1
      plan.issues.push(rowIssue(rowNumber, `Unknown member: ${memberName}.`, 'Fix the member name to exactly match an existing CGA member first.'))
      return
    }

    const canonicalMember = memberLookup.get(memberKey)
    const key = [normalizeKey(canonicalMember), date, amount.toFixed(2), normalizeKey(note), normalizeKey(reference)].join('|')

    if (fileKeys.has(key)) {
      plan.duplicates.push({ rowNumber, reason: 'Duplicate row in file', key, member: canonicalMember })
      plan.validRows += 1
      return
    }
    fileKeys.add(key)

    if (existingKeys.has(key)) {
      plan.duplicates.push({ rowNumber, reason: 'Duplicate of existing transaction', key, member: canonicalMember })
      plan.validRows += 1
      return
    }

    plan.toAdd.push({
      rowNumber,
      transaction: {
        member: canonicalMember,
        amount,
        date,
        note,
        reference,
      },
    })
    plan.validRows += 1
  })

  plan.summary = buildSummary(plan)
  return plan
}

function planTournamentImport(rows, context, mode) {
  const plan = basePlan('tournaments', mode)
  const existingTournamentIds = new Set(Object.keys(context.resultsByTournament || {}))
  const fileIds = new Set()

  plan.rowsDetected = rows.length
  rows.forEach(({ rowNumber, row }) => {
    const tournamentId = toText(row.tournamentId)
    const title = toText(row.title)
    const date = normalizeDate(row.date)
    const course = toText(row.course)
    const format = toText(row.format)
    const hasEntryFeeValue = row.entryFee !== '' && row.entryFee != null
    const entryFee = hasEntryFeeValue ? toNumber(row.entryFee) : null

    if (!tournamentId || !title || !date) {
      plan.invalidRows += 1
      plan.issues.push(rowIssue(rowNumber, 'Missing required values (tournamentId, title, date).', 'Provide tournamentId, title, and a valid date (YYYY-MM-DD).'))
      return
    }
    if (hasEntryFeeValue && entryFee == null) {
      plan.invalidRows += 1
      plan.issues.push(rowIssue(rowNumber, `Invalid entryFee: ${row.entryFee}.`, 'Use a numeric entryFee value, e.g. 95.'))
      return
    }

    if (fileIds.has(tournamentId)) {
      plan.duplicates.push({ rowNumber, reason: 'Duplicate tournamentId in file', key: tournamentId })
      plan.validRows += 1
      return
    }
    fileIds.add(tournamentId)

    if (existingTournamentIds.has(tournamentId)) {
      plan.duplicates.push({ rowNumber, reason: 'Tournament already exists in results', key: tournamentId })
      plan.validRows += 1
      return
    }

    plan.toAdd.push({
      rowNumber,
      tournamentId,
      doc: {
        id: tournamentId,
        name: title,
        date,
        course,
        format,
        entryFee,
        imported: true,
        leaderboard: {},
      },
    })
    plan.validRows += 1
  })

  plan.summary = buildSummary(plan)
  return plan
}

function planResultsImport(rows, context, mode) {
  const plan = basePlan('results', mode)
  const memberLookup = context.memberLookup
  const resultsByTournament = context.resultsByTournament || {}
  const existingKeys = new Set()

  Object.entries(resultsByTournament).forEach(([tournamentId, resultDoc]) => {
    Object.entries(resultDoc?.leaderboard || {}).forEach(([flight, entries]) => {
      entries.forEach((entry) => {
        const key = [tournamentId, normalizeFlight(flight), normalizeKey(entry?.name)].join('|')
        existingKeys.add(key)
      })
    })
  })

  const fileKeys = new Set()
  plan.rowsDetected = rows.length

  rows.forEach(({ rowNumber, row }) => {
    const tournamentId = toText(row.tournamentId)
    const flight = normalizeFlight(row.flight)
    const member = toText(row.member)
    const score = toNumber(row.score)
    const position = toNumber(row.position)
    const notes = toText(row.notes)

    if (!tournamentId || !flight || !member || score == null) {
      plan.invalidRows += 1
      plan.issues.push(rowIssue(rowNumber, 'Missing required values (tournamentId, flight, member, score).', 'Complete all required fields in this row.'))
      return
    }
    if (!resultsByTournament[tournamentId]) {
      plan.invalidRows += 1
      plan.issues.push(rowIssue(rowNumber, `Tournament ${tournamentId} does not exist in results.`, 'Import the tournament first (Tournaments template), then retry this results import.'))
      return
    }
    if (!memberLookup.has(normalizeKey(member))) {
      plan.invalidRows += 1
      plan.issues.push(rowIssue(rowNumber, `Unknown member: ${member}.`, 'Use a member name that already exists in Member Management.'))
      return
    }

    const canonicalMember = memberLookup.get(normalizeKey(member))
    const key = [tournamentId, flight, normalizeKey(canonicalMember)].join('|')

    if (fileKeys.has(key)) {
      plan.duplicates.push({ rowNumber, reason: 'Duplicate row in file', key })
      plan.validRows += 1
      return
    }
    fileKeys.add(key)

    if (existingKeys.has(key)) {
      plan.duplicates.push({ rowNumber, reason: 'Duplicate existing result row', key })
      plan.validRows += 1
      return
    }

    plan.toAdd.push({
      rowNumber,
      tournamentId,
      flight,
      row: {
        name: canonicalMember,
        rank: position ?? null,
        points: score,
        score,
        ptm: context.memberPtmLookup[canonicalMember] ?? null,
        plusMinus: context.memberPtmLookup[canonicalMember] != null ? score - Number(context.memberPtmLookup[canonicalMember]) : null,
        poy: 0,
        notes,
      },
    })
    plan.validRows += 1
  })

  plan.summary = buildSummary(plan)
  return plan
}

function toLastFirstKey(name) {
  // Convert "First Last" → "last, first" so import files using either format match
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return null
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return normalizeKey(`${last}, ${first}`)
}

export function buildImportContext({ members = [], resultsByTournament = {}, credits = {}, creditTransactions = [] }) {
  const memberLookup = new Map()
  members.forEach(member => {
    memberLookup.set(normalizeKey(member.name), member.name)
    const lastFirstKey = toLastFirstKey(member.name)
    if (lastFirstKey && !memberLookup.has(lastFirstKey)) {
      memberLookup.set(lastFirstKey, member.name)
    }
  })
  const memberPtmLookup = Object.fromEntries(members.map(member => [member.name, member.ptm]))

  const creditTransactionKeys = (creditTransactions || []).map((entry) => {
    const member = entry?.member ?? entry?.memberName ?? ''
    const date = normalizeDate(entry?.date)
    const amount = toAmount(entry?.amount)
    const note = toText(entry?.note)
    const reference = toText(entry?.reference)
    if (!member || !date || amount == null) return null
    return [normalizeKey(member), date, amount.toFixed(2), normalizeKey(note), normalizeKey(reference)].join('|')
  }).filter(Boolean)

  return {
    memberLookup,
    memberPtmLookup,
    resultsByTournament,
    credits,
    creditTransactionKeys,
  }
}

export function applyImportPlan({ plan, state }) {
  if (!plan || plan.issues.length > 0) {
    throw new Error('Cannot apply import with blocking validation issues.')
  }

  if (plan.importType === 'credits') {
    const nextCredits = { ...(state.credits || {}) }
    const transactions = plan.toAdd.map(item => ({
      ...item.transaction,
      ts: Date.now(),
      source: 'bulk-import',
    }))

    plan.toAdd.forEach(({ transaction }) => {
      const current = Number(nextCredits[transaction.member] ?? 0)
      nextCredits[transaction.member] = Math.round((current + transaction.amount) * 100) / 100
    })

    return {
      credits: nextCredits,
      creditTransactions: transactions,
    }
  }

  if (plan.importType === 'tournaments') {
    const resultDocs = {}
    plan.toAdd.forEach(({ tournamentId, doc }) => {
      resultDocs[tournamentId] = doc
    })
    return { resultDocs }
  }

  const resultDocs = {}
  const grouped = new Map()

  plan.toAdd.forEach((item) => {
    const key = item.tournamentId
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(item)
  })

  grouped.forEach((items, tournamentId) => {
    const existing = state.resultsByTournament[tournamentId] || { id: tournamentId, leaderboard: {} }
    const nextLeaderboard = { ...(existing.leaderboard || {}) }

    items.forEach((item) => {
      const currentRows = Array.isArray(nextLeaderboard[item.flight]) ? [...nextLeaderboard[item.flight]] : []
      currentRows.push(item.row)
      nextLeaderboard[item.flight] = currentRows
    })

    Object.keys(nextLeaderboard).forEach((flight) => {
      nextLeaderboard[flight] = [...nextLeaderboard[flight]].sort((a, b) => {
        if (a.rank != null && b.rank != null) return a.rank - b.rank
        return Number(b.points ?? 0) - Number(a.points ?? 0)
      }).map((row, idx) => ({ ...row, rank: row.rank ?? idx + 1 }))
    })

    resultDocs[tournamentId] = {
      ...existing,
      leaderboard: nextLeaderboard,
      imported: true,
    }
  })

  return { resultDocs }
}
