import { useState, useMemo, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import PageWrapper from '../components/layout/PageWrapper'
import schedule from '../data/schedule.json'
import membersData from '../data/members.json'
import currentStandings from '../data/standings.json'

const FLIGHTS      = ['Championship', '1st Flight', '2nd Flight', '3rd Flight', '4th Flight', '5th Flight']
const STORAGE_KEY  = 'cga_admin_v1'
const PAIRINGS_KEY = 'cga_pairings_v1'
const CREDITS_KEY  = 'cga_credits_v1'
const PIN          = 'cga2026'

const PDF_NAVY = [27,  59,  111]
const PDF_GOLD = [201, 168, 76]

const flightTagStyles = {
  Championship: 'bg-amber-50 text-amber-700 border-amber-200',
  '1st Flight': 'bg-blue-50 text-blue-700 border-blue-200',
  '2nd Flight': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '3rd Flight': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '4th Flight': 'bg-purple-50 text-purple-700 border-purple-200',
  '5th Flight': 'bg-pink-50 text-pink-700 border-pink-200',
  Unassigned:   'bg-gray-100 text-gray-600 border-gray-200',
}

// ── POY calculation ───────────────────────────────────────────────────────────
function calcFlightPOY(players) {
  if (!players.length) return players
  const n     = players.length
  const scale = Array.from({ length: n }, (_, i) => 350 - 25 * i)

  const withPM = players.map((p, i) => {
    const hasData = p.ptm !== '' && p.score !== '' && p.ptm != null && p.score != null
    return { ...p, _i: i, _has: hasData, plusMinus: hasData ? Number(p.score) - Number(p.ptm) : null }
  })

  const complete = withPM.filter(p => p._has).sort((a, b) => b.plusMinus - a.plusMinus)
  const rankMap  = {}
  let pos = 0
  while (pos < complete.length) {
    const val   = complete[pos].plusMinus
    const group = []
    let j = pos
    while (j < complete.length && complete[j].plusMinus === val) { group.push(j); j++ }
    const avg = group.reduce((s, idx) => s + (scale[idx] ?? 0), 0) / group.length
    group.forEach(idx => {
      rankMap[complete[idx]._i] = { rank: pos + 1, poy: complete[idx].eligible !== false ? avg : 0 }
    })
    pos = j
  }
  return withPM.map((p, i) => ({ ...p, rank: rankMap[i]?.rank ?? null, poy: rankMap[i]?.poy ?? null }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtPM  = pm => pm == null ? '—' : pm > 0 ? `+${pm}` : `${pm}`
const fmtPOY = p  => p.poy == null ? '—' : p.eligible === false ? 'X' : p.poy % 1 === 0 ? String(p.poy) : p.poy.toFixed(1)

function downloadJSON(obj, filename) {
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })),
    download: filename,
  })
  a.click()
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// ── PDF utilities ─────────────────────────────────────────────────────────────
async function loadLogoBase64() {
  try {
    const res = await fetch('/cga-logo.jpg')
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror   = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function buildPdfHeader(doc, title, subtitle = '') {
  const pw   = doc.internal.pageSize.getWidth()
  const logo = await loadLogoBase64()

  // Navy header bar
  doc.setFillColor(...PDF_NAVY)
  doc.rect(0, 0, pw, 38, 'F')

  // Logo
  if (logo) doc.addImage(logo, 'JPEG', 10, 4, 30, 30)

  // CGA name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('Carencro Golf Association', 46, 15)

  // Gold rule inside header
  doc.setDrawColor(...PDF_GOLD)
  doc.setLineWidth(0.8)
  doc.line(46, 18, pw - 10, 18)

  // Document title
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...PDF_GOLD)
  doc.text(title, 46, 26)

  if (subtitle) {
    doc.setFontSize(8)
    doc.setTextColor(180, 195, 220)
    doc.text(subtitle, 46, 33)
  }

  // Gold rule below header
  doc.setDrawColor(...PDF_GOLD)
  doc.setLineWidth(1)
  doc.line(0, 38, pw, 38)

  return 46  // content startY
}

function addPdfFooter(doc, note = '') {
  const pw      = doc.internal.pageSize.getWidth()
  const ph      = doc.internal.pageSize.getHeight()
  const total   = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...PDF_GOLD)
    doc.setLineWidth(0.4)
    doc.line(14, ph - 15, pw - 14, ph - 15)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 140, 140)
    const left  = note || 'Carencro Golf Association · CGA 2026'
    const right = `Page ${i} of ${total}`
    doc.text(left,  14,       ph - 10)
    doc.text(right, pw - 14,  ph - 10, { align: 'right' })
  }
}

// ── PDF: Tournament Info ──────────────────────────────────────────────────────
async function exportTournamentInfoPDF(tournament) {
  if (!tournament) return
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const pw  = doc.internal.pageSize.getWidth()
  let y = await buildPdfHeader(doc, 'Tournament Information', 'CGA 2026 Season')

  // Big tournament name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...PDF_NAVY)
  const nameLines = doc.splitTextToSize(tournament.name, pw - 28)
  doc.text(nameLines, 14, y + 6)
  y += 8 + nameLines.length * 9

  doc.setDrawColor(...PDF_GOLD)
  doc.setLineWidth(0.8)
  doc.line(14, y, pw - 14, y)
  y += 10

  const fields = [
    ['DATE',                  fmtDate(tournament.date)],
    ['COURSE',                tournament.course || '—'],
    ['TEE TIME',              tournament.teeTime || '—'],
    ['FORMAT',                tournament.format || '—'],
    ['ENTRY FEE',             tournament.entryFee || '—'],
    ['REGISTRATION DEADLINE', fmtDateShort(tournament.dueDate)],
  ]

  fields.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...PDF_NAVY)
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(13)
    doc.setTextColor(25, 25, 25)
    doc.text(value, 14, y + 6)
    y += 16
  })

  if (tournament.notes) {
    doc.setDrawColor(210, 215, 225)
    doc.setLineWidth(0.3)
    doc.line(14, y, pw - 14, y)
    y += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...PDF_NAVY)
    doc.text('NOTES', 14, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    const noteLines = doc.splitTextToSize(tournament.notes, pw - 28)
    doc.text(noteLines, 14, y)
    y += noteLines.length * 5 + 6
  }

  // Empty notes area with lines for handwritten additions
  doc.setDrawColor(210, 215, 225)
  doc.setLineWidth(0.3)
  doc.line(14, y, pw - 14, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...PDF_NAVY)
  doc.text('ADDITIONAL NOTES', 14, y)
  y += 6
  for (let i = 0; i < 4; i++) {
    doc.setDrawColor(190, 195, 205)
    doc.setLineWidth(0.2)
    doc.line(14, y, pw - 14, y)
    y += 8
  }

  addPdfFooter(doc, `Generated ${new Date().toLocaleDateString()} · Carencro Golf Association`)
  const slug = tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  doc.save(`${slug}-tournament-info.pdf`)
}

// ── PDF: Pairings ─────────────────────────────────────────────────────────────
async function exportPairingsPDF(tournament, pairings) {
  if (!tournament || !pairings.length) return
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const pw  = doc.internal.pageSize.getWidth()
  const y = await buildPdfHeader(
    doc,
    'Pairings',
    `${tournament.name} · ${fmtDate(tournament.date)} · ${tournament.course}`
  )

  const maxPlayers = Math.max(...pairings.map(c => c.players.length))
  const playerCols = Array.from({ length: maxPlayers }, (_, i) => `Player ${i + 1}`)

  const body = pairings.map((card, i) => {
    const row = [i + 1]
    for (let j = 0; j < maxPlayers; j++) {
      const p = card.players[j]
      row.push(p ? `${p.name}  (${p.flight})` : '')
    }
    return row
  })

  autoTable(doc, {
    head:            [['#', ...playerCols]],
    body,
    startY:          y,
    theme:           'striped',
    headStyles:      { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    styles:          { fontSize: 9, cellPadding: 3 },
    columnStyles:    { 0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' } },
    margin:          { left: 14, right: 14 },
  })

  addPdfFooter(doc, `Generated ${new Date().toLocaleDateString()} · Carencro Golf Association`)
  const slug = tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  doc.save(`${slug}-pairings.pdf`)
}

// ── PDF: Points to Make ───────────────────────────────────────────────────────
async function exportPtmPDF() {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = await buildPdfHeader(doc, 'Points to Make', 'CGA 2026 Season — Full Roster by Flight')

  const grouped = FLIGHTS.reduce((acc, f) => ({ ...acc, [f]: [] }), {})
  const unassigned = []
  for (const m of membersData) {
    if (m.active === false) continue
    if (m.flight && grouped[m.flight]) grouped[m.flight].push(m)
    else unassigned.push(m)
  }

  const flightColors = {
    'Championship': [160, 110, 0],
    '1st Flight':   [30,  80,  180],
    '2nd Flight':   [55,  60,  165],
    '3rd Flight':   [20,  120, 80],
    '4th Flight':   [100, 40,  150],
    '5th Flight':   [180, 50,  100],
  }

  for (const fl of FLIGHTS) {
    const members = grouped[fl]
    if (!members.length) continue

    const color = flightColors[fl] ?? PDF_NAVY

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...color)
    doc.text(fl.toUpperCase(), 14, y + 4)

    autoTable(doc, {
      head:            [['#', 'Player', 'PTM', 'Tee']],
      body:            members
                         .slice().sort((a, b) => a.name.localeCompare(b.name))
                         .map((m, i) => [i + 1, m.name, m.ptm ?? '—', m.tee ?? '—']),
      startY:          y + 6,
      theme:           'striped',
      headStyles:      { fillColor: color, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      styles:          { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
        3: { halign: 'center', cellWidth: 20 },
      },
      margin: { left: 14, right: 14 },
    })

    y = doc.lastAutoTable.finalY + 8
  }

  if (unassigned.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('UNASSIGNED', 14, y + 4)

    autoTable(doc, {
      head:            [['#', 'Player', 'PTM', 'Tee']],
      body:            unassigned
                         .slice().sort((a, b) => a.name.localeCompare(b.name))
                         .map((m, i) => [i + 1, m.name, m.ptm ?? '—', m.tee ?? '—']),
      startY:          y + 6,
      theme:           'striped',
      headStyles:      { fillColor: [110, 110, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      styles:          { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
        3: { halign: 'center', cellWidth: 20 },
      },
      margin: { left: 14, right: 14 },
    })
  }

  addPdfFooter(doc, `Generated ${new Date().toLocaleDateString()} · Carencro Golf Association`)
  doc.save('cga-2026-points-to-make.pdf')
}

// ── PDF: Tournament Results ───────────────────────────────────────────────────
async function exportResultsPDF(tournament, flightData) {
  if (!tournament) return
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = await buildPdfHeader(
    doc,
    'Tournament Results',
    `${tournament.name} · ${fmtDate(tournament.date)} · ${tournament.course}`
  )

  const flightColors = {
    'Championship': [160, 110, 0],
    '1st Flight':   [30,  80,  180],
    '2nd Flight':   [55,  60,  165],
    '3rd Flight':   [20,  120, 80],
    '4th Flight':   [100, 40,  150],
    '5th Flight':   [180, 50,  100],
  }

  for (const fl of FLIGHTS) {
    const rawPs = flightData[fl] ?? []
    const ps    = calcFlightPOY(rawPs)
    if (!ps.length) continue

    const ranked   = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
    const unranked = ps.filter(p => p.rank == null)
    const rows     = [...ranked, ...unranked]

    const color = flightColors[fl] ?? PDF_NAVY

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...color)
    doc.text(fl.toUpperCase(), 14, y + 4)

    autoTable(doc, {
      head: [['Rank', 'Player', 'PTM', 'Score', '+/−', 'POY Pts']],
      body: rows.map(p => [
        p.rank ?? '—',
        p.name + (p.eligible === false ? ' *' : ''),
        p.ptm  ?? '—',
        p.score ?? '—',
        p.plusMinus == null ? '—' : p.plusMinus > 0 ? `+${p.plusMinus}` : String(p.plusMinus),
        fmtPOY(p),
      ]),
      startY: y + 6,
      theme:  'striped',
      headStyles:         { fillColor: color, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      styles:             { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'center', cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section !== 'body') return
        const p = rows[data.row.index]
        if (!p) return
        if (data.column.index === 0 && p.rank != null && p.rank <= 3) {
          data.cell.styles.fontStyle   = 'bold'
          data.cell.styles.textColor   = p.rank === 1 ? PDF_GOLD : color
        }
        if (data.column.index === 4 && p.plusMinus != null) {
          data.cell.styles.textColor = p.plusMinus > 0 ? [0, 140, 60] : p.plusMinus < 0 ? [180, 30, 30] : [100, 100, 100]
        }
      },
    })

    y = doc.lastAutoTable.finalY + 8
  }

  addPdfFooter(doc, `* = ineligible for POY · Generated ${new Date().toLocaleDateString()} · CGA`)
  const slug = tournament.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  doc.save(`${slug}-results.pdf`)
}

// ── PDF: Credit on Books ──────────────────────────────────────────────────────
async function exportCreditsPDF(credits) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  let y = await buildPdfHeader(
    doc,
    'Credit on Books',
    `CGA 2026 · As of ${new Date().toLocaleDateString()}`
  )

  const rows = membersData
    .filter(m => m.active !== false)
    .map(m => ({ name: m.name, flight: m.flight ?? 'Unassigned', balance: credits[m.name] ?? 0 }))
    .sort((a, b) => {
      if (a.balance !== 0 && b.balance === 0) return -1
      if (a.balance === 0 && b.balance !== 0) return 1
      if (a.balance !== b.balance) return b.balance - a.balance
      return a.name.localeCompare(b.name)
    })

  const total        = rows.reduce((s, r) => s + r.balance, 0)
  const nonZeroCount = rows.filter(r => r.balance !== 0).length

  autoTable(doc, {
    head: [['#', 'Player', 'Flight', 'Balance']],
    body: rows.map((r, i) => [
      i + 1,
      r.name,
      r.flight,
      r.balance === 0
        ? '$0.00'
        : `${r.balance < 0 ? '−' : ''}$${Math.abs(r.balance).toFixed(2)}`,
    ]),
    foot:   [['', '', 'TOTAL', `${total < 0 ? '−' : ''}$${Math.abs(total).toFixed(2)}`]],
    startY: y,
    theme:  'striped',
    headStyles:         { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    footStyles:         { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    styles:             { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      3: { halign: 'right',  cellWidth: 30 },
    },
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      if (data.section !== 'body') return
      const r = rows[data.row.index]
      if (!r) return
      if (data.column.index === 3) {
        if (r.balance > 0)      data.cell.styles.textColor = [0, 140, 60]
        else if (r.balance < 0) data.cell.styles.textColor = [180, 30, 30]
        else                    data.cell.styles.textColor = [180, 180, 180]
      }
      if (r.balance !== 0) data.cell.styles.fontStyle = 'bold'
    },
  })

  addPdfFooter(doc, `${nonZeroCount} member${nonZeroCount !== 1 ? 's' : ''} with balance · Total: $${total.toFixed(2)}`)
  doc.save('cga-2026-credit-on-books.pdf')
}

// ── PIN gate ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const [pin,      setPin]      = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [err,      setErr]      = useState(false)

  const tryUnlock = () => {
    if (pin === PIN) { setUnlocked(true) }
    else { setErr(true); setTimeout(() => setErr(false), 1500) }
  }

  if (!unlocked) return (
    <PageWrapper>
      <div className="max-w-xs mx-auto mt-24">
        <h1 className="section-title text-2xl mb-6">Admin</h1>
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <input
            type="password" value={pin} onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            placeholder="PIN" autoFocus
            className={`w-full border rounded px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-forest ${err ? 'border-red-400' : 'border-gray-300'}`}
          />
          {err && <p className="text-red-500 text-xs font-sans">Incorrect PIN.</p>}
          <button onClick={tryUnlock} className="btn-primary w-full text-center">Unlock</button>
        </div>
      </div>
    </PageWrapper>
  )

  return <AdminPanel />
}

// ── Admin panel ───────────────────────────────────────────────────────────────
function AdminPanel() {
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
  })
  const [pairingsData, setPairingsData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PAIRINGS_KEY)) || {} } catch { return {} }
  })
  const [credits, setCredits] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CREDITS_KEY)) || {} } catch { return {} }
  })

  const [saved,          setSaved]          = useState(false)
  const [tid,            setTid]            = useState(schedule[0]?.id ?? '')
  const [flight,         setFlight]         = useState(FLIGHTS[0])
  const [poolSearch,     setPoolSearch]     = useState('')
  const [exportNote,     setExportNote]     = useState('')
  const [adminMode,      setAdminMode]      = useState('scores')  // 'scores' | 'pairings' | 'credits'
  const [groupSize,      setGroupSize]      = useState(4)
  const [creditSearch,   setCreditSearch]   = useState('')
  const [creditInputs,   setCreditInputs]   = useState({})
  const [selectedPool,   setSelectedPool]   = useState(new Set())

  // score entry drag state
  const dragRef        = useRef(null)
  const [dragOverRow,  setDragOverRow]  = useState(null)
  const [dragOverPool, setDragOverPool] = useState(false)

  // pairings drag state
  const pDragRef    = useRef(null)
  const [pDragOver, setPDragOver] = useState(null)

  // persist score data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 1200)
    return () => clearTimeout(t)
  }, [data])

  // persist pairings data
  useEffect(() => {
    localStorage.setItem(PAIRINGS_KEY, JSON.stringify(pairingsData))
  }, [pairingsData])

  // persist credits
  useEffect(() => {
    localStorage.setItem(CREDITS_KEY, JSON.stringify(credits))
  }, [credits])

  // Clear pool selection when tournament or flight changes
  useEffect(() => { setSelectedPool(new Set()) }, [tid, flight])

  const tournament     = schedule.find(t => t.id === tid)
  const nextTournament = schedule.find(t => t.status === 'upcoming') ?? schedule[schedule.length - 1]
  const rawPlayers     = data[tid]?.[flight] ?? []
  const players      = useMemo(() => calcFlightPOY(rawPlayers), [rawPlayers])
  const totalPlayers = FLIGHTS.reduce((sum, f) => sum + (data[tid]?.[f]?.length ?? 0), 0)

  // all names entered for this tournament across all flights
  const allAddedNames = useMemo(() => {
    const names = new Set()
    for (const fl of FLIGHTS) {
      for (const p of (data[tid]?.[fl] ?? [])) names.add(p.name)
    }
    return names
  }, [data, tid])

  // pool members grouped by their season flight from members.json
  const poolMembersGrouped = useMemo(() => {
    const search = poolSearch.trim().toLowerCase()
    const filtered = membersData.filter(m =>
      !allAddedNames.has(m.name) &&
      (search === '' || m.name.toLowerCase().includes(search))
    )
    const groups = {}
    for (const f of [...FLIGHTS, null]) {
      const key = f ?? '__unassigned__'
      groups[key] = filtered.filter(m => f === null ? m.flight == null : m.flight === f)
    }
    return groups
  }, [allAddedNames, poolSearch])

  const poolTotalCount = useMemo(
    () => Object.values(poolMembersGrouped).reduce((s, g) => s + g.length, 0),
    [poolMembersGrouped]
  )

  // pairings derived
  const currentPairings = pairingsData[tid] ?? []
  const pairedNames     = useMemo(
    () => new Set(currentPairings.flatMap(c => c.players.map(p => p.name))),
    [currentPairings]
  )
  const unpairedPlayers = useMemo(
    () => FLIGHTS.flatMap(fl =>
      (data[tid]?.[fl] ?? [])
        .filter(p => !pairedNames.has(p.name))
        .map(p => ({ name: p.name, flight: fl }))
    ),
    [data, tid, pairedNames]
  )

  // credits derived
  const creditRoster = useMemo(() => {
    const search = creditSearch.trim().toLowerCase()
    return membersData
      .filter(m => m.active !== false)
      .filter(m => !search || m.name.toLowerCase().includes(search))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [creditSearch])

  const creditTotal = useMemo(
    () => Object.values(credits).reduce((s, v) => s + v, 0),
    [credits]
  )

  const creditNonZero = useMemo(
    () => Object.values(credits).filter(v => v !== 0).length,
    [credits]
  )

  // ── Score data mutations ────────────────────────────────────────────────────
  function flightSet(newList) {
    setData(prev => ({ ...prev, [tid]: { ...(prev[tid] ?? {}), [flight]: newList } }))
  }

  function insertPlayer(name, atIdx) {
    if (allAddedNames.has(name)) return
    const fl = [...rawPlayers]
    fl.splice(atIdx, 0, { name, ptm: '', score: '', eligible: true })
    flightSet(fl)
  }

  function addPlayer(name) {
    if (allAddedNames.has(name)) return
    flightSet([...rawPlayers, { name, ptm: '', score: '', eligible: true }])
  }

  function addSelectedPlayers() {
    const toAdd = [...selectedPool].filter(n => !allAddedNames.has(n))
    if (!toAdd.length) return
    flightSet([...rawPlayers, ...toAdd.map(name => ({ name, ptm: '', score: '', eligible: true }))])
    setSelectedPool(new Set())
  }

  function togglePoolSelect(name) {
    setSelectedPool(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function toggleGroupSelect(members) {
    const names     = members.map(m => m.name)
    const allChosen = names.every(n => selectedPool.has(n))
    setSelectedPool(prev => {
      const next = new Set(prev)
      if (allChosen) names.forEach(n => next.delete(n))
      else           names.forEach(n => next.add(n))
      return next
    })
  }

  function removePlayer(idx) {
    const fl = [...rawPlayers]; fl.splice(idx, 1); flightSet(fl)
  }

  function reorderPlayer(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const fl     = [...rawPlayers]
    const [item] = fl.splice(fromIdx, 1)
    fl.splice(toIdx <= fromIdx ? toIdx : toIdx - 1, 0, item)
    flightSet(fl)
  }

  function updatePlayer(idx, field, val) {
    const fl = [...rawPlayers]
    fl[idx]  = { ...fl[idx], [field]: val }
    flightSet(fl)
  }

  function clearFlight() {
    if (!window.confirm(`Clear all players from ${flight}?`)) return
    flightSet([])
  }

  function movePlayerToFlight(playerIdx, targetFlight) {
    const player = rawPlayers[playerIdx]
    if (!player) return
    setData(prev => {
      const td = { ...(prev[tid] ?? {}) }
      const srcList = [...(td[flight] ?? [])]
      srcList.splice(playerIdx, 1)
      td[flight] = srcList
      const dstList = [...(td[targetFlight] ?? [])]
      dstList.push({ ...player })
      td[targetFlight] = dstList
      return { ...prev, [tid]: td }
    })
  }

  // ── Credit mutations ────────────────────────────────────────────────────────
  function applyCredit(name, amount) {
    const n = parseFloat(amount)
    if (isNaN(n) || n === 0) return
    setCredits(prev => ({ ...prev, [name]: +((prev[name] ?? 0) + n).toFixed(2) }))
    setCreditInputs(prev => ({ ...prev, [name]: '' }))
  }

  function clearCredit(name) {
    setCredits(prev => { const next = { ...prev }; delete next[name]; return next })
  }

  function clearAllCredits() {
    if (!window.confirm('Clear ALL credit balances? This cannot be undone.')) return
    setCredits({})
  }

  // ── Score drag handlers ─────────────────────────────────────────────────────
  function onDragStartPool(e, name) {
    dragRef.current = { source: 'pool', name }
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onDragStartRow(e, idx) {
    dragRef.current = { source: 'flight', fromIdx: idx }
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOverRow(e, rowIdx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragRef.current?.source === 'pool' ? 'copy' : 'move'
    setDragOverRow(rowIdx)
    setDragOverPool(false)
  }

  function onDragOverZone(e) {
    e.preventDefault()
    setDragOverRow('zone')
    setDragOverPool(false)
  }

  function onDragOverPool(e) {
    e.preventDefault()
    if (dragRef.current?.source === 'flight') {
      setDragOverPool(true)
      setDragOverRow(null)
    }
  }

  function onDropRow(e, rowIdx) {
    e.preventDefault()
    const d = dragRef.current
    if (!d) return
    if (d.source === 'pool')   insertPlayer(d.name, rowIdx)
    if (d.source === 'flight') reorderPlayer(d.fromIdx, rowIdx)
    resetDrag()
  }

  function onDropZone(e) {
    e.preventDefault()
    const d = dragRef.current
    if (!d) return
    if (d.source === 'pool')   addPlayer(d.name)
    if (d.source === 'flight') reorderPlayer(d.fromIdx, rawPlayers.length)
    resetDrag()
  }

  function onDropPool(e) {
    e.preventDefault()
    const d = dragRef.current
    if (d?.source === 'flight') removePlayer(d.fromIdx)
    resetDrag()
  }

  function resetDrag() {
    dragRef.current = null
    setDragOverRow(null)
    setDragOverPool(false)
  }

  // ── Pairings functions ──────────────────────────────────────────────────────
  function generatePairings() {
    const allPlayers = FLIGHTS.flatMap(fl =>
      (data[tid]?.[fl] ?? []).map(p => ({ name: p.name, flight: fl }))
    )
    if (!allPlayers.length) return
    allPlayers.sort((a, b) => FLIGHTS.indexOf(a.flight) - FLIGHTS.indexOf(b.flight))
    const numGroups  = Math.ceil(allPlayers.length / groupSize)
    const groups     = Array.from({ length: numGroups }, () => [])
    allPlayers.forEach((p, i) => groups[i % numGroups].push(p))
    const newPairings = groups.map((ps, i) => ({ pairing: `Pairing ${i + 1}`, players: ps }))
    setPairingsData(prev => ({ ...prev, [tid]: newPairings }))
  }

  function clearPairings() {
    if (!window.confirm('Clear all pairings for this tournament?')) return
    setPairingsData(prev => ({ ...prev, [tid]: [] }))
  }

  function removePairedPlayer(cardIdx, playerIdx) {
    const updated = currentPairings.map((c, ci) =>
      ci === cardIdx
        ? { ...c, players: c.players.filter((_, pi) => pi !== playerIdx) }
        : c
    )
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
  }

  function onPDragStart(e, cardIdx, playerIdx) {
    pDragRef.current = { cardIdx, playerIdx }
    e.dataTransfer.effectAllowed = 'move'
  }

  function onPDragOver(e, cardIdx) {
    e.preventDefault()
    setPDragOver(cardIdx)
  }

  function onPDrop(e, targetCardIdx) {
    e.preventDefault()
    const d = pDragRef.current
    if (!d || d.cardIdx === targetCardIdx) { pDragRef.current = null; setPDragOver(null); return }
    const updated = currentPairings.map(c => ({ ...c, players: [...c.players] }))
    const [player] = updated[d.cardIdx].players.splice(d.playerIdx, 1)
    updated[targetCardIdx].players.push(player)
    setPairingsData(prev => ({ ...prev, [tid]: updated }))
    pDragRef.current = null
    setPDragOver(null)
  }

  function exportPairingsJSON() {
    if (!tournament || !currentPairings.length) return
    const slug = tid.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    downloadJSON(
      { id: tid, tournament: tournament.name, source: 'CGA Admin', pairings: currentPairings },
      `${slug}-pairings.json`
    )
  }

  // ── Results export (JSON) ───────────────────────────────────────────────────
  function doExport() {
    if (!tournament) return
    const flightWinners = [], leaderboard = {}
    for (const fl of FLIGHTS) {
      const ps     = calcFlightPOY(data[tid]?.[fl] ?? [])
      const ranked = [...ps].filter(p => p.rank != null).sort((a, b) => a.rank - b.rank || b.plusMinus - a.plusMinus)
      const allRows = [...ranked, ...ps.filter(p => p.rank == null)]
      leaderboard[fl] = allRows.map(p => ({
        rank: p.rank ?? 0, name: p.name, poy: p.poy ?? 0,
        points: Number(p.score) || 0, ptm: Number(p.ptm) || 0, plusMinus: p.plusMinus ?? 0,
      }))
      if (ranked[0]) flightWinners.push({ flight: fl, winner: ranked[0].name, points: ranked[0].poy ?? 0 })
    }

    const resultFile = {
      id: tid, name: tournament.name, date: tournament.date, course: tournament.course,
      format: 'Individual Stroke Play', status: 'completed', flightWinners, leaderboard,
    }

    const newPoy = { flights: {} }
    for (const fl of FLIGHTS) {
      const ps = calcFlightPOY(data[tid]?.[fl] ?? [])
      newPoy.flights[fl] = [...ps].sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))
        .map((p, i) => ({ rank: i + 1, name: p.name, points: p.poy ?? 0, events: 1 }))
    }

    const ptmLookup     = Object.fromEntries(membersData.map(m => [m.name, m.ptm]))
    const prevPtmLookup = {}
    for (const fl of FLIGHTS) {
      for (const p of (currentStandings.flights[fl] ?? [])) {
        if (p.ptm != null) prevPtmLookup[p.name] = p.ptm
      }
    }

    const newStandings = { flights: {} }
    for (const fl of FLIGHTS) {
      const ps     = calcFlightPOY(data[tid]?.[fl] ?? [])
      const sorted = [...ps].sort((a, b) => (b.poy ?? -1) - (a.poy ?? -1))
      newStandings.flights[fl] = sorted.map((p, i) => {
        const newPtm   = ptmLookup[p.name] ?? (Number(p.ptm) || null)
        const oldPtm   = prevPtmLookup[p.name] ?? null
        const ptmDelta = (newPtm != null && oldPtm != null) ? +(newPtm - oldPtm).toFixed(2) : 0
        return {
          rank: i + 1, name: p.name, poy: p.poy ?? 0, ptm: newPtm, ptmDelta,
          latestScore: Number(p.score) || null, latestTournament: tournament.name, events: 1, trend: 'up',
        }
      })
    }

    const slug = tid.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    downloadJSON(resultFile, `${slug}-results.json`)
    setTimeout(() => downloadJSON(newPoy,       'poy.json'),       200)
    setTimeout(() => downloadJSON(newStandings, 'standings.json'), 400)
    setExportNote(
      `3 files downloaded.\n` +
      `1. Place ${slug}-results.json → src/data/results/\n` +
      `2. Replace poy.json and standings.json → src/data/\n` +
      `3. In Results.jsx add:\n` +
      `   import r${slug.replace(/-/g, '_')} from '../data/results/${slug}-results.json'\n` +
      `   '${tid}': r${slug.replace(/-/g, '_')}  ← add to resultFiles`
    )
  }

  // ── Derived for promote/relegate ────────────────────────────────────────────
  const flightIdx  = FLIGHTS.indexOf(flight)
  const prevFlight = flightIdx > 0                  ? FLIGHTS[flightIdx - 1] : null
  const nextFlight = flightIdx < FLIGHTS.length - 1 ? FLIGHTS[flightIdx + 1] : null

  // ── Shared PDF button helper ────────────────────────────────────────────────
  const PdfBtn = ({ onClick, children, disabled = false }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold rounded border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
      {children}
    </button>
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="section-title text-3xl">Tournament Admin</h1>
          <div className="gold-divider" />
        </div>
        {saved && <span className="text-green-600 font-sans text-xs mb-7">Saved ✓</span>}
      </div>

      {/* Tournament selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <label className="block text-xs font-sans font-semibold uppercase tracking-widest text-forest mb-2">Tournament</label>
        <select
          value={tid}
          onChange={e => { setTid(e.target.value); setFlight(FLIGHTS[0]); setPoolSearch('') }}
          className="border border-gray-300 rounded px-3 py-2 text-sm font-sans w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-forest"
        >
          {schedule.map(t => <option key={t.id} value={t.id}>{t.name} — {t.date}</option>)}
        </select>
        {tournament && (
          <p className="text-xs text-gray-400 font-sans mt-1.5">
            {tournament.course} · {tournament.format} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} entered
          </p>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          ['scores',   'Score Entry'],
          ['pairings', 'Pairings Builder'],
          ['credits',  'Credit on Books'],
        ].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setAdminMode(mode)}
            className={`px-4 py-2 text-xs font-sans font-semibold rounded-md transition-colors ${
              adminMode === mode
                ? 'bg-forest text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-forest'
            }`}
          >
            {label}
            {mode === 'credits' && creditNonZero > 0 && (
              <span className="ml-1.5 bg-gold text-forest rounded-full px-1.5 py-0.5 text-[10px] font-bold">{creditNonZero}</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SCORE ENTRY MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'scores' && (
        <>
          {/* Flight tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {FLIGHTS.map(f => {
              const cnt = data[tid]?.[f]?.length ?? 0
              return (
                <button key={f} onClick={() => { setFlight(f); setPoolSearch('') }}
                  className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
                    flight === f ? 'bg-gold text-forest' : 'bg-white text-gray-500 border border-gray-200 hover:text-forest hover:border-gold'
                  }`}
                >
                  {f}{cnt > 0 && <span className="ml-1 opacity-60">({cnt})</span>}
                </button>
              )
            })}
          </div>

          {/* Two-panel drag-and-drop layout */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6" onDragEnd={resetDrag}>

            {/* ── Left: Member pool ── */}
            <div className="lg:w-72 flex-shrink-0">
              <div
                className={`bg-white border rounded-lg overflow-hidden flex flex-col transition-colors ${
                  dragOverPool ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                onDragOver={onDragOverPool}
                onDrop={onDropPool}
                onDragLeave={() => setDragOverPool(false)}
              >
                {/* Pool header */}
                <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-white font-sans text-sm font-semibold">Members</p>
                    <p className="text-white/50 text-xs font-sans mt-0.5">Check or drag into flight →</p>
                  </div>
                  {selectedPool.size > 0 && (
                    <span className="bg-gold text-forest text-xs font-bold font-sans rounded-full px-2 py-0.5 flex-shrink-0">
                      {selectedPool.size}
                    </span>
                  )}
                </div>

                {dragOverPool && (
                  <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                    <p className="text-red-500 text-xs font-sans text-center">Drop to remove from flight</p>
                  </div>
                )}

                {/* Search */}
                <div className="px-3 py-2 border-b border-gray-100">
                  <input
                    type="text"
                    value={poolSearch}
                    onChange={e => setPoolSearch(e.target.value)}
                    placeholder="Search members…"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
                  />
                </div>

                {/* Member list */}
                <div className="overflow-y-auto flex-1" style={{ maxHeight: '460px' }}>
                  {poolTotalCount === 0 && !poolSearch.trim() ? (
                    <p className="text-gray-400 text-xs font-sans text-center py-6">All members added.</p>
                  ) : poolTotalCount === 0 && poolSearch.trim() ? (
                    <p className="text-gray-400 text-xs font-sans text-center py-6">No matches.</p>
                  ) : (
                    <div className="p-2">
                      {[...FLIGHTS, null].map(f => {
                        const key   = f ?? '__unassigned__'
                        const group = poolMembersGrouped[key] ?? []
                        if (!group.length) return null
                        const allGroupSelected = group.every(m => selectedPool.has(m.name))
                        const someGroupSelected = group.some(m => selectedPool.has(m.name))
                        return (
                          <div key={key} className="mb-2">
                            {/* Group header row with select-all checkbox */}
                            <div className="flex items-center gap-1.5 px-1 pt-1 pb-0.5">
                              <input
                                type="checkbox"
                                checked={allGroupSelected}
                                ref={el => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected }}
                                onChange={() => toggleGroupSelect(group)}
                                className="accent-forest cursor-pointer w-3 h-3 flex-shrink-0"
                              />
                              <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-gray-400 flex-1">
                                {f ?? 'Unassigned'}
                              </span>
                              <span className="text-[10px] text-gray-300 font-mono">{group.length}</span>
                            </div>
                            <ul className="space-y-0.5">
                              {group.map(m => {
                                const isSelected = selectedPool.has(m.name)
                                return (
                                  <li
                                    key={m.name}
                                    draggable
                                    onDragStart={e => onDragStartPool(e, m.name)}
                                    onClick={() => togglePoolSelect(m.name)}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border transition-colors select-none ${
                                      isSelected
                                        ? 'bg-forest/8 border-forest/30 ring-1 ring-forest/20'
                                        : 'bg-gray-50 hover:bg-blue-50 hover:border-gold border-transparent'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => togglePoolSelect(m.name)}
                                      onClick={e => e.stopPropagation()}
                                      className="accent-forest cursor-pointer w-3.5 h-3.5 flex-shrink-0"
                                    />
                                    <span className={`font-sans text-xs truncate ${isSelected ? 'text-forest font-semibold' : 'text-darktext'}`}>
                                      {m.name}
                                    </span>
                                    <span
                                      className="text-gray-300 text-sm leading-none flex-shrink-0 ml-auto cursor-grab active:cursor-grabbing"
                                      onMouseDown={e => e.stopPropagation()}
                                    >⠿</span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )
                      })}
                      {poolSearch.trim() && !membersData.some(m => m.name.toLowerCase() === poolSearch.toLowerCase()) && (
                        <li
                          onClick={() => { addPlayer(poolSearch.trim()); setPoolSearch('') }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border border-dashed border-gold text-gold hover:bg-amber-50 transition-colors mt-1"
                        >
                          <span className="text-sm leading-none">+</span>
                          <span className="font-sans text-xs truncate">Add "{poolSearch.trim()}"</span>
                        </li>
                      )}
                    </div>
                  )}
                </div>

                {/* Sticky action bar — shown when players are selected */}
                {selectedPool.size > 0 && (
                  <div className="border-t border-forest/20 bg-forest/5 px-3 py-2.5 flex items-center gap-2">
                    <span className="text-forest font-sans text-xs font-semibold flex-1">
                      {selectedPool.size} selected
                    </span>
                    <button
                      onClick={() => setSelectedPool(new Set())}
                      className="px-2 py-1 text-xs font-sans text-gray-400 hover:text-gray-600 transition-colors rounded"
                    >
                      Clear
                    </button>
                    <button
                      onClick={addSelectedPlayers}
                      className="px-3 py-1.5 bg-forest text-white text-xs font-sans font-semibold rounded hover:bg-forest-dark transition-colors"
                    >
                      Add to {flight}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: Flight panel ── */}
            <div className="flex-1 min-w-0">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-sans text-sm font-semibold">{flight}</span>
                    {(prevFlight || nextFlight) && (
                      <span className="text-white/40 font-sans text-xs">
                        {prevFlight && <span>▲ promotes → {prevFlight}</span>}
                        {prevFlight && nextFlight && <span className="mx-1.5">·</span>}
                        {nextFlight && <span>▼ relegates → {nextFlight}</span>}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gold font-mono text-xs">{rawPlayers.length} players</span>
                    {rawPlayers.length > 0 && (
                      <button onClick={clearFlight} className="text-gray-300 hover:text-red-300 text-xs font-sans transition-colors">
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {players.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="table-header text-gray-300 w-6 px-2"></th>
                          <th className="table-header text-gray-400 text-left w-10">Rank</th>
                          <th className="table-header text-gray-400 text-left">Player</th>
                          <th className="table-header text-gray-400 text-center">PTM</th>
                          <th className="table-header text-gray-400 text-center">Score</th>
                          <th className="table-header text-gray-400 text-center">+/-</th>
                          <th className="table-header text-gray-400 text-center">POY</th>
                          <th className="table-header text-gray-400 text-center">Elig.</th>
                          <th className="table-header text-gray-400 text-center w-16">Move</th>
                          <th className="table-header text-gray-400 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((p, idx) => (
                          <tr
                            key={p.name}
                            draggable
                            onDragStart={e => onDragStartRow(e, idx)}
                            onDragOver={e => onDragOverRow(e, idx)}
                            onDrop={e => onDropRow(e, idx)}
                            className={`border-b border-gray-100 last:border-0 transition-colors hover:bg-blue-50 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            } ${dragOverRow === idx ? 'border-t-2 border-t-gold' : ''}`}
                          >
                            <td className="px-2 py-2 text-center cursor-grab active:cursor-grabbing">
                              <span className="text-gray-300 text-sm select-none">⠿</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`stat-number text-xs font-semibold ${p.rank != null && p.rank <= 3 ? 'text-gold' : 'text-gray-400'}`}>
                                {p.rank ?? '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-sans text-sm text-darktext whitespace-nowrap">{p.name}</td>
                            <td className="px-2 py-1.5 text-center">
                              <input type="number" value={p.ptm} onChange={e => updatePlayer(idx, 'ptm', e.target.value)}
                                className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <input type="number" value={p.score} onChange={e => updatePlayer(idx, 'score', e.target.value)}
                                className="w-14 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`stat-number text-xs font-semibold ${
                                p.plusMinus == null ? 'text-gray-300' : p.plusMinus > 0 ? 'text-green-600' : p.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'
                              }`}>
                                {fmtPM(p.plusMinus)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`stat-number text-xs font-semibold ${
                                p.eligible === false ? 'text-red-400' : p.poy == null ? 'text-gray-300' : 'text-darktext'
                              }`}>
                                {fmtPOY(p)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={p.eligible !== false}
                                onChange={e => updatePlayer(idx, 'eligible', e.target.checked)}
                                className="accent-forest cursor-pointer w-4 h-4"
                              />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  title={prevFlight ? `Promote to ${prevFlight}` : 'Already top flight'}
                                  disabled={!prevFlight}
                                  onClick={() => prevFlight && movePlayerToFlight(idx, prevFlight)}
                                  className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                >▲</button>
                                <button
                                  title={nextFlight ? `Relegate to ${nextFlight}` : 'Already bottom flight'}
                                  disabled={!nextFlight}
                                  onClick={() => nextFlight && movePlayerToFlight(idx, nextFlight)}
                                  className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                                >▼</button>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => removePlayer(idx)} className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div
                      onDragOver={onDragOverZone}
                      onDrop={onDropZone}
                      className={`h-8 transition-colors ${dragOverRow === 'zone' ? 'bg-amber-50 border-t-2 border-t-gold' : ''}`}
                    />
                  </div>
                ) : (
                  <div
                    onDragOver={onDragOverZone}
                    onDrop={onDropZone}
                    className={`flex flex-col items-center justify-center py-16 border-2 border-dashed m-4 rounded-lg transition-colors ${
                      dragOverRow === 'zone' ? 'border-gold bg-amber-50' : 'border-gray-200'
                    }`}
                  >
                    <span className="text-3xl mb-2 text-gray-300">⠿</span>
                    <p className="text-gray-400 font-sans text-sm">Drag players here from the list</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Export & Publish */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-forest font-sans text-xs font-semibold uppercase tracking-widest mb-1">Export & Publish</h2>
            <p className="text-gray-500 font-sans text-xs mb-4 leading-relaxed">
              Downloads updated JSON files. Replace in <code className="bg-gray-100 px-1 rounded">src/data/</code> and commit to publish sitewide.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={doExport} className="btn-primary text-xs py-2 px-4">
                Download All JSON Files
              </button>
              <PdfBtn onClick={() => exportResultsPDF(tournament, data[tid] ?? {})} disabled={!tournament || totalPlayers === 0}>
                Export Results PDF
              </PdfBtn>
            </div>
            {exportNote && (
              <pre className="mt-4 bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">
                {exportNote}
              </pre>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PAIRINGS BUILDER MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'pairings' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans font-semibold text-gray-500 uppercase tracking-widest">Group size</span>
              {[3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setGroupSize(n)}
                  className={`w-8 h-8 rounded text-xs font-mono font-bold transition-colors ${
                    groupSize === n ? 'bg-gold text-forest' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {currentPairings.length > 0 && (
                <>
                  <button
                    onClick={generatePairings}
                    className="px-3 py-1.5 text-xs font-sans font-semibold rounded border border-forest text-forest hover:bg-forest hover:text-white transition-colors"
                  >
                    Regenerate
                  </button>
                  <button onClick={exportPairingsJSON} className="btn-primary text-xs py-1.5 px-3">
                    Export Pairings JSON
                  </button>
                  <PdfBtn onClick={() => exportPairingsPDF(tournament, currentPairings)} disabled={!tournament}>
                    Export Pairings PDF
                  </PdfBtn>
                  <button
                    onClick={clearPairings}
                    className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
              {currentPairings.length === 0 && totalPlayers > 0 && (
                <button onClick={generatePairings} className="btn-primary text-xs">
                  Generate Pairings
                </button>
              )}
            </div>
          </div>

          {totalPlayers === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
              <p className="text-amber-700 font-sans text-sm font-medium mb-1">No players entered yet</p>
              <p className="text-amber-600 font-sans text-xs">Switch to Score Entry to add players to flights first.</p>
            </div>
          )}

          {unpairedPlayers.length > 0 && currentPairings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
              <span className="text-amber-700 font-sans text-xs font-semibold uppercase tracking-widest flex-shrink-0">
                Not yet paired ({unpairedPlayers.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {unpairedPlayers.map(p => (
                  <span key={p.name} className={`text-xs border px-2 py-0.5 rounded-full font-sans ${flightTagStyles[p.flight] ?? flightTagStyles.Unassigned}`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {currentPairings.length === 0 && totalPlayers > 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-lg py-16 flex flex-col items-center justify-center">
              <p className="text-gray-400 font-sans text-sm mb-4">No pairings generated yet.</p>
              <button onClick={generatePairings} className="btn-primary text-xs">
                Generate Pairings
              </button>
            </div>
          )}

          {currentPairings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {currentPairings.map((card, cardIdx) => (
                <div
                  key={cardIdx}
                  onDragOver={e => onPDragOver(e, cardIdx)}
                  onDrop={e => onPDrop(e, cardIdx)}
                  onDragLeave={() => setPDragOver(null)}
                  className={`bg-white border rounded-lg overflow-hidden transition-colors ${
                    pDragOver === cardIdx ? 'border-gold ring-2 ring-gold/30' : 'border-gray-200'
                  }`}
                >
                  <div className="bg-forest px-4 py-2 flex items-center justify-between">
                    <span className="text-white font-sans text-xs font-semibold uppercase tracking-widest">
                      {card.pairing}
                    </span>
                    <span className="text-white/50 font-mono text-xs">{card.players.length}</span>
                  </div>
                  <ul className="divide-y divide-gray-100 min-h-[60px]">
                    {card.players.map((player, playerIdx) => (
                      <li
                        key={player.name}
                        draggable
                        onDragStart={e => onPDragStart(e, cardIdx, playerIdx)}
                        className="px-3 py-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-300 text-xs leading-none flex-shrink-0">⠿</span>
                          <span className="font-sans text-sm text-darktext truncate">{player.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[player.flight] ?? flightTagStyles.Unassigned}`}>
                            {player.flight}
                          </span>
                          <button
                            onClick={() => removePairedPlayer(cardIdx, playerIdx)}
                            className="text-gray-300 hover:text-red-400 text-base leading-none transition-colors ml-0.5"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                    {card.players.length === 0 && (
                      <li className="px-3 py-4 text-center text-gray-300 font-sans text-xs italic">
                        Drag players here
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {currentPairings.length > 0 && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-500 font-sans text-xs leading-relaxed">
                Export the pairings JSON and place it in <code className="bg-gray-100 px-1 rounded">src/data/pairings/</code>, then
                import it in <code className="bg-gray-100 px-1 rounded">src/pages/Pairings.jsx</code> and add the entry to the{' '}
                <code className="bg-gray-100 px-1 rounded">pairingsById</code> map.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          CREDIT ON BOOKS MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {adminMode === 'credits' && (
        <div>
          {/* Controls bar */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-48">
              <input
                type="text"
                value={creditSearch}
                onChange={e => setCreditSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="text-xs font-sans text-gray-500">
                <span className="font-semibold text-forest">{creditNonZero}</span> with balance ·{' '}
                <span className={`font-semibold stat-number ${creditTotal > 0 ? 'text-green-600' : creditTotal < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {creditTotal < 0 ? '−' : ''}${Math.abs(creditTotal).toFixed(2)}
                </span>{' '}
                total
              </div>
              <PdfBtn onClick={() => exportCreditsPDF(credits)}>
                Export Credits PDF
              </PdfBtn>
              {Object.keys(credits).length > 0 && (
                <button
                  onClick={clearAllCredits}
                  className="px-3 py-1.5 text-xs font-sans rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Credit table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-forest px-4 py-2.5 flex items-center justify-between">
              <span className="text-white font-sans text-sm font-semibold">Member Credit Balances</span>
              <span className="text-white/50 font-sans text-xs">{creditRoster.length} members</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[540px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="table-header text-gray-400 text-left">Player</th>
                    <th className="table-header text-gray-400 text-left">Flight</th>
                    <th className="table-header text-gray-400 text-right">Balance</th>
                    <th className="table-header text-gray-400 text-center">Add / Subtract</th>
                    <th className="table-header text-gray-400 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {creditRoster.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400 font-sans text-sm">
                        No members match your search.
                      </td>
                    </tr>
                  ) : (
                    creditRoster.map((m, idx) => {
                      const balance = credits[m.name] ?? 0
                      const input   = creditInputs[m.name] ?? ''
                      return (
                        <tr
                          key={m.name}
                          className={`border-b border-gray-100 last:border-0 transition-colors ${
                            balance !== 0 ? 'hover:bg-amber-50/30' : 'hover:bg-gray-50'
                          } ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                        >
                          <td className="px-4 py-2.5 font-sans text-sm text-darktext whitespace-nowrap">{m.name}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs border px-1.5 py-0.5 rounded-full font-sans whitespace-nowrap ${flightTagStyles[m.flight] ?? flightTagStyles.Unassigned}`}>
                              {m.flight ?? 'Unassigned'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`stat-number text-sm font-bold ${
                              balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-gray-300'
                            }`}>
                              {balance < 0 ? '−' : ''}${Math.abs(balance).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                value={input}
                                onChange={e => setCreditInputs(prev => ({ ...prev, [m.name]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && applyCredit(m.name, input)}
                                placeholder="+/− $"
                                className="w-24 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                              />
                              <button
                                onClick={() => applyCredit(m.name, input)}
                                disabled={!input}
                                title="Apply adjustment"
                                className="w-7 h-7 flex items-center justify-center bg-forest text-white rounded text-sm font-bold disabled:opacity-30 hover:bg-forest-dark transition-colors"
                              >
                                ✓
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {balance !== 0 && (
                              <button
                                onClick={() => clearCredit(m.name)}
                                title="Clear balance"
                                className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {creditNonZero > 0 && (
                  <tfoot>
                    <tr className="bg-forest/5 border-t-2 border-forest/20">
                      <td colSpan={2} className="px-4 py-2.5 font-sans text-xs font-semibold uppercase tracking-widest text-forest">
                        Total on Books
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`stat-number text-sm font-bold ${
                          creditTotal > 0 ? 'text-green-600' : creditTotal < 0 ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {creditTotal < 0 ? '−' : ''}${Math.abs(creditTotal).toFixed(2)}
                        </span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PDF REPORTS  (always visible)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-forest font-sans text-xs font-semibold uppercase tracking-widest mb-1">PDF Reports</h2>
        <p className="text-gray-500 font-sans text-xs mb-4 leading-relaxed">
          Generate printable PDF documents for distribution.
        </p>
        <div className="flex flex-wrap gap-2">
          <PdfBtn onClick={() => exportTournamentInfoPDF(nextTournament)} disabled={!nextTournament}>
            Next Tournament Info
          </PdfBtn>
          <PdfBtn onClick={() => exportTournamentInfoPDF(tournament)} disabled={!tournament}>
            Selected Tournament Info
          </PdfBtn>
          <PdfBtn onClick={() => exportPtmPDF()}>
            Points to Make (Full Roster)
          </PdfBtn>
          {totalPlayers > 0 && (
            <PdfBtn onClick={() => exportResultsPDF(tournament, data[tid] ?? {})} disabled={!tournament}>
              Tournament Results
            </PdfBtn>
          )}
          {currentPairings.length > 0 && (
            <PdfBtn onClick={() => exportPairingsPDF(tournament, currentPairings)} disabled={!tournament}>
              Pairings
            </PdfBtn>
          )}
          {Object.keys(credits).length > 0 && (
            <PdfBtn onClick={() => exportCreditsPDF(credits)}>
              Credit on Books
            </PdfBtn>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
