import * as XLSX from 'xlsx-js-style'
import { formatName, compareByLastName } from '../utils/formatName'
import { compareFlights, FLIGHT_ORDER } from '../utils/flightOrder'
import { calcFlightPOY } from '../utils/poy'

const FLIGHTS = FLIGHT_ORDER

// ── Results sanitization (shared by results export) ─────────────────────────
export function sanitizeResultsData(flightData = {}) {
  const cleanNumber = (value) => {
    if (value === '' || value == null) return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  const cleanText = (value) => {
    if (value == null) return ''
    return String(value).replace(/[^\x20-\x7E]/g, '').trim()
  }

  return Object.fromEntries(FLIGHTS.map((flight) => {
    const rows = Array.isArray(flightData?.[flight]) ? flightData[flight] : []
    const normalizedRows = rows
      .filter(Boolean)
      .map((row) => {
        const score = cleanNumber(row?.score)
        const ptm = cleanNumber(row?.ptm)
        return {
          ...row,
          name: cleanText(row?.name),
          score,
          ptm,
          preEventPtm: ptm,
          plusMinus: (score == null || ptm == null) ? null : score - ptm,
        }
      })
      .filter(row => row.name)
    return [flight, normalizedRows]
  }))
}

// ── Excel roster parsing ────────────────────────────────────────────────────
function normalizeTee(t) {
  if (!t) return null
  const s = String(t).trim().toUpperCase()
  if (s === 'BACK')  return 'Back'
  if (s === 'SR' || s === 'SENIOR') return 'Senior'
  if (s === 'FRONT') return 'Front'
  return null
}

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

/**
 * Parse an ArrayBuffer of an .xlsx file and return an array of
 * { name, tee, ptm, history, rounds } objects matched against membersData.
 * Returns { matched, unmatched } where:
 *   matched   = rows we found a member for
 *   unmatched = rows from Excel we couldn't link to a member
 */
export function parseRosterXlsx(buffer, membersList) {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames.find(s => s.toLowerCase().includes('roster')) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })

  // Build a reverse lookup: "First Last" → memberName
  // lastNameIdx uses the actual surname (skipping trailing suffixes like Jr/Sr/III)
  const exactLookup  = {}   // normalized "First Last" → memberName
  const lastNameIdx  = {}   // lowercase surname → [memberName, ...]

  for (const m of membersList) {
    exactLookup[m.name.toLowerCase()] = m.name
    const words = m.name.split(' ')
    const lastWord = words[words.length - 1].toLowerCase()
    // If the last word is a suffix, use the second-to-last word as the surname
    const surname = (NAME_SUFFIXES.has(lastWord) && words.length > 2)
      ? words[words.length - 2].toLowerCase()
      : lastWord
    if (!lastNameIdx[surname]) lastNameIdx[surname] = []
    lastNameIdx[surname].push(m.name)
  }

  function findMember(rawExcelName) {
    if (!rawExcelName) return null
    const nameStr = String(rawExcelName).trim()

    // If "Last, First" format, convert to "First Last" for lookup
    let firstName, lastName
    if (nameStr.includes(',')) {
      const parts = nameStr.split(',').map(s => s.trim())
      lastName = parts[0]
      firstName = parts.slice(1).join(' ').trim()
    } else {
      // "First Last" format
      const words = nameStr.split(/\s+/)
      firstName = words.slice(0, -1).join(' ')
      lastName = words[words.length - 1]
      if (!firstName) {
        // Single word, try exact lookup
        return exactLookup[nameStr.toLowerCase()] ?? null
      }
    }

    // Try direct reassembly: "First Last"
    const fullName = (firstName + ' ' + lastName).toLowerCase()
    if (exactLookup[fullName]) return exactLookup[fullName]

    // If firstName ends with a suffix (e.g. "Alan Sr"), try "First LastName Suffix"
    const firstParts = firstName.split(' ')
    const lastFirstPart = firstParts[firstParts.length - 1].toLowerCase()
    if (NAME_SUFFIXES.has(lastFirstPart) && firstParts.length > 1) {
      const firstOnly = firstParts.slice(0, -1).join(' ')
      const altName = (firstOnly + ' ' + lastName + ' ' + firstParts[firstParts.length - 1]).toLowerCase()
      if (exactLookup[altName]) return exactLookup[altName]
    }

    // Last-name fuzzy: if only one member has this surname, use it
    const lastLower = lastName.toLowerCase()
    const candidates = lastNameIdx[lastLower]
    if (candidates?.length === 1) return candidates[0]

    return null
  }

  // Detect the name column — try common header names case-insensitively
  const firstRowKeys = Object.keys(rows[0] ?? {})
  const nameColKey = firstRowKeys.find(k => /^(name|player|member|golfer|full.?name|member.?name)$/i.test(k))

  const matched   = []
  const unmatched = []

  for (const row of rows) {
    const rawName = (nameColKey ? row[nameColKey] : null) ?? row['__EMPTY'] ?? row['Name'] ?? row['Player'] ?? null
    if (!rawName) continue

    const tee             = normalizeTee(row['Tees'] ?? row['Tee'] ?? null)
    const ptm             = row['Points to make'] ?? row['PTM'] ?? null
    const creditOnBooks   = row['Credit on Books'] !== null ? Number(row['Credit on Books']) : null
    const email           = row['Email Address'] ?? row['Email'] ?? null
    const homePhone       = row['Home Phone'] ?? null
    const cellPhone       = row['Cell/Work'] ?? row['Cell'] ?? row['Work'] ?? row['Phone'] ?? null
    const history = [
      row['NEW'] ?? row['1st'] ?? null,
      row['2nd'] ?? null,
      row['3rd'] ?? null,
      row['4th'] ?? null,
      row['5th'] ?? null,
      row['6th'] ?? null,
      row['7th'] ?? null,
    ]
    const rounds = history.filter(v => v !== null).length

    const memberName = findMember(rawName)
    const entry = {
      rawName: String(rawName),
      tee, ptm, creditOnBooks, email, homePhone, cellPhone,
      history, rounds, memberName
    }

    if (memberName) matched.push(entry)
    else unmatched.push(entry)
  }

  return { matched, unmatched }
}

// ── Excel: Credit on Books ──────────────────────────────────────────────────
export function exportCreditsXLSX(credits, membersList) {
  const rows = membersList
    .filter(m => m.active !== false)
    .map(m => ({ name: m.name, flight: m.flight ?? 'Unassigned', balance: credits[m.name] ?? 0 }))
    .sort(compareByLastName)
  const total = rows.reduce((s, r) => s + r.balance, 0)
  const wb = XLSX.utils.book_new()
  const wsData = [
    ['Player', 'Flight', 'Credit on Books'],
    ...rows.map(r => [formatName(r.name), r.flight, r.balance]),
    ['', 'TOTAL', total],
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Credit on Books')
  XLSX.writeFile(wb, 'cga-2026-credit-on-books.xlsx')
}

// ── Excel: Tournament Results ───────────────────────────────────────────────
export function exportResultsXLSX(tournament, flightData) {
  if (!tournament) return
  const sanitizedFlightData = sanitizeResultsData(flightData)
  const wb = XLSX.utils.book_new()
  for (const fl of FLIGHTS) {
    const rawPs = sanitizedFlightData[fl] ?? []
    const ps = calcFlightPOY(rawPs)
    if (!ps.length) continue
    const ranked   = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
    const unranked = ps.filter(p => p.rank == null)
    const rows = [...ranked, ...unranked]
    const wsData = [
      ['Rank', 'Player', 'PTM', 'Score', 'Net', 'POY Pts', 'Eligible'],
      ...rows.map(p => [
        p.rank ?? '',
        p.name,
        p.preEventPtm ?? '',
        p.score ?? '',
        p.plusMinus == null ? '' : p.plusMinus,
        p.poy == null && p.score != null ? 'Pending' : (p.poy == null ? '' : p.poy),
        p.eligible === false ? 'No' : 'Yes',
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, fl.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 31))
  }
  XLSX.writeFile(wb, `${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-results.xlsx`)
}

export function exportBirdiePoolXLSX(tournament, flightData, allFlights) {
  if (!tournament) return
  const SITE_BLUE = 'FF0B2E6D'
  const HEADER_NEUTRAL = 'FFEFF3F8'
  const TEXT_DARK = 'FF1F2937'
  const WHITE = 'FFFFFFFF'
  const ROW_GOLD_TINT = 'FFFFF9EC'
  const BORDER_COLOR = 'FFD1D5DB'

  const splitBirdieName = (name = '') => {
    const cleaned = String(name).trim()
    if (!cleaned) return { last: '', first: '' }
    if (cleaned.includes(',')) {
      const [last = '', ...firstParts] = cleaned.split(',')
      return {
        last: last.trim(),
        first: firstParts.join(',').trim(),
      }
    }
    const parts = cleaned.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return { last: parts[0], first: '' }
    return {
      last: parts[parts.length - 1],
      first: parts.slice(0, -1).join(' '),
    }
  }

  const uniqueNames = [...new Set(
    allFlights.flatMap(flight => (flightData?.[flight] ?? []).map(player => player?.name).filter(Boolean))
  )].sort((a, b) => compareByLastName({ name: a }, { name: b }))
  const headers = ['#', 'Last', 'First', ...Array.from({ length: 18 }, (_, idx) => String(idx + 1))]
  const wsData = [
    headers,
    ...uniqueNames.map((name, index) => {
      const normalized = formatName(name)
      const { last, first } = splitBirdieName(normalized)
      return [index + 1, last, first, ...Array.from({ length: 18 }, () => '')]
    }),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 4 },  // #
    { wch: 18 }, // Last
    { wch: 16 }, // First
    ...Array.from({ length: 18 }, () => ({ wch: 4.5 })),
  ]
  ws['!freeze'] = { xSplit: 3, ySplit: 1, topLeftCell: 'D2', state: 'frozen', activePane: 'bottomRight' }

  const range = XLSX.utils.decode_range(ws['!ref'] || `A1:${XLSX.utils.encode_cell({ r: wsData.length - 1, c: headers.length - 1 })}`)
  const thinBorder = {
    top: { style: 'thin', color: { rgb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { rgb: BORDER_COLOR } },
    left: { style: 'thin', color: { rgb: BORDER_COLOR } },
    right: { style: 'thin', color: { rgb: BORDER_COLOR } },
  }

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
      if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' }
      const isHeader = row === 0
      const isCoreHeader = isHeader && col <= 2
      const isHoleHeader = isHeader && col >= 3
      const isNameColumn = col === 1 || col === 2
      const isHoleCell = col >= 3
      const isEvenPlayerRow = row > 0 && row % 2 === 0
      const fillColor = isHeader
        ? (isCoreHeader ? HEADER_NEUTRAL : SITE_BLUE)
        : (isEvenPlayerRow ? ROW_GOLD_TINT : WHITE)

      ws[cellAddress].s = {
        font: {
          bold: isHeader || isNameColumn,
          color: { rgb: isHoleHeader ? WHITE : TEXT_DARK },
        },
        fill: { patternType: 'solid', fgColor: { rgb: fillColor }, bgColor: { rgb: fillColor } },
        alignment: {
          vertical: 'center',
          horizontal: isHoleCell || isHeader || col === 0 ? 'center' : 'left',
        },
        border: thinBorder,
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Birdie Pool')
  XLSX.writeFile(wb, `${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-birdie-pool.xlsx`)
}

export function exportPayoutDocXLSX(tournament, resultDoc) {
  if (!tournament || !resultDoc?.leaderboard) return false
  const wb = XLSX.utils.book_new()
  for (const [flight, rows] of Object.entries(resultDoc.leaderboard)
    .sort(([flightA], [flightB]) => compareFlights(flightA, flightB, { includeNewPlayers: true }))) {
    const ranked = (Array.isArray(rows) ? rows : [])
      .filter(row => (row.rank ?? 0) > 0)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    const sheetRows = ranked.map(row => ({
      Rank: row.rank ?? '',
      Player: formatName(row.name),
      '+/-': row.plusMinus ?? '',
      POY: row.poy ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(sheetRows)
    XLSX.utils.book_append_sheet(wb, ws, flight.slice(0, 31))
  }
  XLSX.writeFile(wb, `${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-payout.xlsx`)
  return true
}

// ── Excel: Field Roster ─────────────────────────────────────────────────────
export function exportPaymentsXLSX(tournament, paymentMap, membersList, preTournamentByName = {}) {
  if (!tournament) return
  const members = membersList.map(m => {
    const pre = preTournamentByName[m.name]
    return pre ? { ...m, flight: pre.flight ?? m.flight } : m
  })
  const wsData = [
    ['Player', 'Flight'],
    ...members
      .filter(m => m.active !== false && paymentMap[m.name])
      .slice()
      .sort(compareByLastName)
      .map(m => [m.name, m.flight ?? 'Unassigned']),
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Field Roster')
  XLSX.writeFile(wb, `${tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-field-roster.xlsx`)
}

// ── Excel: Points to Make ───────────────────────────────────────────────────
export function exportPtmXLSX(membersList, ptmList = [], preTournamentByName = {}) {
  const ptmByName = Object.fromEntries((ptmList || []).map(p => [p.name, p]))
  const enriched = membersList.map(m => {
    const p = ptmByName[m.name]
    const base = p ? { ...m, history: p.history ?? m.history } : m
    const pre = preTournamentByName[m.name]
    return pre?.ptm != null ? { ...base, ptm: pre.ptm } : base
  })
  membersList = enriched
  const roundLabels = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']
  const memberRow = m => {
    const hist = Array.isArray(m.history) ? m.history : []
    return [
      m.flight ?? 'Unassigned',
      formatName(m.name),
      typeof m.ptm === 'number' ? Math.round(m.ptm) : (m.ptm ?? ''),
      m.tee ?? '',
      ...roundLabels.map((_, i) => hist[i] ?? ''),
    ]
  }
  const wsData = [
    ['Flight', 'Player', 'PTM', 'Tee', ...roundLabels],
    ...FLIGHTS.flatMap(fl =>
      membersList
        .filter(m => m.active !== false && m.flight === fl)
        .slice()
        .sort(compareByLastName)
        .map(memberRow)
    ),
    ...membersList
      .filter(m => m.active !== false && !FLIGHTS.includes(m.flight))
      .slice()
      .sort(compareByLastName)
      .map(memberRow),
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, 'Points to Make')
  XLSX.writeFile(wb, 'cga-2026-points-to-make.xlsx')
}
