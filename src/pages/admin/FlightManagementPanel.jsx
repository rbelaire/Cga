import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx-js-style'
import { formatName, compareByLastName } from '../../utils/formatName'
import { roundPtm } from '../../utils/roundPtm'
import { fmtCurrency, fmtPtmValue } from '../../utils/adminFormat'
import TeeTag from '../../components/ui/TeeTag'
import { SaveBtn } from './ui'

const TEE_OPTIONS = ['Back', 'Senior', 'Front']

export function FlightManagementPanel({
  effectiveMembers, membersData, credits, flightSearch, setFlightSearch,
  updateMemberFlight, updateMemberPtm, updateMemberTee, updateMemberName, updateMemberCell, removeMember,
  openConfirm,
  applyCredit,
  savePlayerManagement, playerManagementSaving, playerManagementSaveStatus, flightTagStyles,
  fileInputRef, handleXlsxFile, importPreview, setImportPreview,
  confirmImport, importSaving, importStatus, importError, setImportError,
  allFlights,
}) {
  const FLIGHT_OPTIONS = allFlights
  const SORTABLE_COLUMNS = ['name', 'ptm', 'creditOnBooks', 'tee']
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [editingRows, setEditingRows] = useState({})
  const [rowDrafts, setRowDrafts] = useState({})
  const [creditAdjustments, setCreditAdjustments] = useState({})
  const [creditAppliedFlash, setCreditAppliedFlash] = useState({})
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [bulkTee, setBulkTee] = useState('')
  const [bulkCredit, setBulkCredit] = useState('')
  const [filterFlight, setFilterFlight] = useState('all')
  const [filterTee, setFilterTee] = useState('all')
  const [onlyCredits, setOnlyCredits] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)

  const rows = useMemo(() => {
    const search = flightSearch.trim().toLowerCase()
    return effectiveMembers
      .filter(member => member.active !== false)
      .map(member => {
        const parsedCredit = Number(credits?.[member.name])
        return {
          id: member.id ?? member.name,
          originalName: member.originalName ?? member.name,
          name: member.name,
          flight: (member.flight && allFlights.includes(member.flight)) ? member.flight : null,
          ptm: fmtPtmValue(member.ptm),
          tee: member.tee ?? null,
          creditOnBooks: Number.isFinite(parsedCredit) ? parsedCredit : 0,
        }
      })
      .filter(member => {
        if (search && !member.name.toLowerCase().includes(search) && !formatName(member.name).toLowerCase().includes(search)) return false
        if (filterFlight !== 'all') {
          if (filterFlight === '__unassigned__' && member.flight) return false
          if (filterFlight !== '__unassigned__' && member.flight !== filterFlight) return false
        }
        if (filterTee !== 'all') {
          if (filterTee === '__unset__' && member.tee) return false
          if (filterTee !== '__unset__' && member.tee !== filterTee) return false
        }
        if (onlyCredits && member.creditOnBooks <= 0) return false
        return true
      })
      .sort((a, b) => {
        const direction = sortDir === 'asc' ? 1 : -1
        if (sortBy === 'name') return compareByLastName(a, b) * direction
        if (sortBy === 'ptm') return ((a.ptm ?? Number.NEGATIVE_INFINITY) - (b.ptm ?? Number.NEGATIVE_INFINITY)) * direction
        if (sortBy === 'creditOnBooks') return (a.creditOnBooks - b.creditOnBooks) * direction
        return String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? '')) * direction
      })
  }, [credits, effectiveMembers, filterFlight, filterTee, flightSearch, onlyCredits, sortBy, sortDir])

  const selectedCount = selectedRows.size
  const selectedVisibleNames = useMemo(
    () => rows.filter(row => selectedRows.has(row.originalName)).map(row => row.originalName),
    [rows, selectedRows]
  )
  const allVisibleSelected = rows.length > 0 && rows.every(row => selectedRows.has(row.originalName))
  const hasVisibleRows = rows.length > 0
  const totalCreditOnBooks = useMemo(() => rows.reduce((sum, row) => sum + row.creditOnBooks, 0), [rows])

  const rowHeight = 54
  const viewportHeight = 560
  const shouldVirtualize = rows.length >= 200
  const startIndex = shouldVirtualize ? Math.max(0, Math.floor(scrollTop / rowHeight) - 8) : 0
  const endIndex = shouldVirtualize ? Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 8) : rows.length
  const visibleRows = shouldVirtualize ? rows.slice(startIndex, endIndex) : rows
  const topSpacerHeight = shouldVirtualize ? startIndex * rowHeight : 0
  const bottomSpacerHeight = shouldVirtualize ? (rows.length - endIndex) * rowHeight : 0

  function updateSort(column) {
    if (!SORTABLE_COLUMNS.includes(column)) return
    if (sortBy === column) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(column)
      setSortDir(column === 'name' ? 'asc' : 'desc')
    }
  }

  function startEditingRow(row) {
    setEditingRows(prev => ({ ...prev, [row.originalName]: true }))
    setRowDrafts(prev => ({
      ...prev,
      [row.originalName]: {
        name: row.name,
        tee: row.tee ?? '',
        ptm: row.ptm ?? '',
        cell: row.cell ?? '',
      },
    }))
  }

  function cancelEditingRow(originalName) {
    setEditingRows(prev => ({ ...prev, [originalName]: false }))
    setRowDrafts(prev => {
      const next = { ...prev }
      delete next[originalName]
      return next
    })
  }

  function saveEditingRow(originalName) {
    const draft = rowDrafts[originalName]
    if (!draft) return
    const ptmRaw = String(draft.ptm ?? '').trim()
    const normalizedPtm = ptmRaw === '' ? null : Number(ptmRaw)
    if (ptmRaw !== '' && !Number.isFinite(normalizedPtm)) return
    if (draft.tee && !TEE_OPTIONS.includes(draft.tee)) return
    const newName = (draft.name ?? '').trim()
    if (newName && newName !== originalName) updateMemberName(originalName, newName)
    updateMemberPtm(originalName, ptmRaw === '' ? '' : normalizedPtm)
    updateMemberTee(originalName, draft.tee || '')
    updateMemberCell(originalName, draft.cell || '')
    cancelEditingRow(originalName)
  }

  function applyRowCredit(originalName) {
    const value = creditAdjustments[originalName]
    if (value == null || value === '') return
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed === 0) return
    applyCredit(originalName, parsed)
    setCreditAdjustments(prev => ({ ...prev, [originalName]: '' }))
    setCreditAppliedFlash(prev => ({ ...prev, [originalName]: true }))
    setTimeout(() => setCreditAppliedFlash(prev => ({ ...prev, [originalName]: false })), 1500)
  }

  function toggleSelect(originalName) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(originalName)) next.delete(originalName)
      else next.add(originalName)
      return next
    })
  }

  function toggleSelectVisible() {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) rows.forEach(row => next.delete(row.originalName))
      else rows.forEach(row => next.add(row.originalName))
      return next
    })
  }

  function applyBulkTee() {
    if (!bulkTee || !TEE_OPTIONS.includes(bulkTee) || selectedVisibleNames.length === 0) return
    selectedVisibleNames.forEach(originalName => updateMemberTee(originalName, bulkTee))
  }

  function applyBulkCredit(sign = 1) {
    if (selectedVisibleNames.length === 0) return
    const parsed = Number(bulkCredit)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    selectedVisibleNames.forEach(originalName => applyCredit(originalName, sign * parsed))
    setBulkCredit('')
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-xs font-sans text-gray-500 leading-relaxed">
            Edit individual rows below, or <strong className="text-darktext">upload your spreadsheet</strong> to import tee and PTM data for the whole roster at once.
            Hit <strong className="text-darktext">Save to Cloud</strong> to publish.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleXlsxFile}
            className="hidden"
          />
          <button
            onClick={() => {
              const ws = XLSX.utils.aoa_to_sheet([
                ['Name', 'Tee', 'Points to make', 'Credit on Books', 'Email', 'Phone', 'NEW', '2nd', '3rd', '4th', '5th', '6th', '7th'],
                ['John Smith', 'Back', 90, 0, 'john@example.com', '555-123-4567', 82, 88, 91, '', '', '', ''],
                ['Jane Doe', 'Senior', 105, 5, '', '555-987-6543', 110, 104, 108, 101, 107, 99, 103],
              ])
              const wb = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(wb, ws, 'Roster')
              XLSX.writeFile(wb, 'player-management-template.xlsx')
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-sans font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-sans font-semibold rounded-lg border border-forest text-forest hover:bg-forest hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Excel
          </button>
          <SaveBtn onClick={savePlayerManagement} saving={playerManagementSaving} status={playerManagementSaveStatus} />
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm font-sans text-red-700">
          <span className="font-semibold flex-shrink-0">Import error:</span>
          <span className="flex-1 break-all">{importError}</span>
          <button onClick={() => setImportError(null)} className="flex-shrink-0 text-red-400 hover:text-red-700 leading-none text-lg">×</button>
        </div>
      )}

      {/* Import preview */}
      {importPreview && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-sans font-semibold text-amber-800">
                Ready to import — {importPreview.matched.length} members matched
                {importPreview.unmatched.length > 0 && (
                  <span className="text-amber-600"> · {importPreview.unmatched.length} new members will be created</span>
                )}
              </p>
              <p className="text-xs font-sans text-amber-700 mt-0.5">
                {membersData.length === 0
                  ? 'Bootstrapping roster: all unmatched rows will be added as new members.'
                  : 'This will update member info (tee, PTM, contact, credits).'}
                {' '}Review below then confirm.
              </p>
            </div>
            <button
              onClick={() => setImportPreview(null)}
              className="text-amber-500 hover:text-amber-800 text-lg leading-none flex-shrink-0"
            >×</button>
          </div>

          {/* Sample of changes */}
          <div className="overflow-x-auto rounded border border-amber-200 mb-3">
            <table className="w-full text-xs font-sans min-w-[600px]">
              <thead>
                <tr className="bg-amber-100 text-amber-700">
                  <th className="px-2 py-2 text-left font-semibold">Player</th>
                  <th className="px-2 py-2 text-center font-semibold">Tee</th>
                  <th className="px-2 py-2 text-center font-semibold">PTM</th>
                  <th className="px-2 py-2 text-center font-semibold">Credits</th>
                  <th className="px-2 py-2 text-center font-semibold">Email</th>
                  <th className="px-2 py-2 text-center font-semibold">Cell</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.matched.slice(0, 8).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'}>
                    <td className="px-2 py-1.5 text-darktext font-medium">{formatName(row.memberName)}</td>
                    <td className="px-2 py-1.5 text-center"><TeeTag tee={row.tee} /></td>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-600">{roundPtm(row.ptm) ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-600">{row.creditOnBooks ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500 truncate text-xs">{row.email ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500 truncate text-xs">{row.cellPhone ?? '—'}</td>
                  </tr>
                ))}
                {importPreview.matched.length > 8 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-center text-amber-600 italic">
                      …and {importPreview.matched.length - 8} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {importPreview.unmatched.length > 0 && (
            <p className="text-xs text-amber-600 mb-3">
              <strong>Not matched:</strong> {importPreview.unmatched.map(r => r.rawName).join(', ')}
            </p>
          )}

          <div className="flex gap-2">
            <SaveBtn
              onClick={confirmImport}
              saving={importSaving}
              status={importStatus}
              label={`Import ${importPreview.matched.length + (membersData.length === 0 ? importPreview.unmatched.length : 0)} Members`}
              className="!bg-amber-600 hover:!bg-amber-700"
            />
            <button
              onClick={() => setImportPreview(null)}
              className="px-3 py-2 text-xs font-sans rounded border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-forest px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-3">
            <span className="text-white font-sans text-sm font-semibold">Player Roster</span>
            <span className="text-white/50 font-mono text-xs">{effectiveMembers.length} members</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <select
              value={filterFlight}
              onChange={e => setFilterFlight(e.target.value)}
              className="border border-white/20 rounded px-2 py-1 text-xs font-sans bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="all" className="text-darktext">All Flights</option>
              <option value="__unassigned__" className="text-darktext">Unassigned</option>
              {FLIGHT_OPTIONS.map(flight => <option key={flight} value={flight} className="text-darktext">{flight}</option>)}
            </select>
            <select
              value={filterTee}
              onChange={e => setFilterTee(e.target.value)}
              className="border border-white/20 rounded px-2 py-1 text-xs font-sans bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="all" className="text-darktext">All Tees</option>
              <option value="__unset__" className="text-darktext">No Tee</option>
              {TEE_OPTIONS.map(tee => <option key={tee} value={tee} className="text-darktext">{tee}</option>)}
            </select>
            <label className="text-white/90 text-xs font-sans flex items-center gap-1.5">
              <input type="checkbox" checked={onlyCredits} onChange={e => setOnlyCredits(e.target.checked)} />
              Credit &gt; $0
            </label>
            <input
              type="text"
              value={flightSearch}
              onChange={e => setFlightSearch(e.target.value)}
              placeholder="Search…"
              className="border border-white/20 rounded px-2 py-1 text-xs font-sans bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold w-32 sm:w-40"
            />
          </div>
        </div>

        <div className="border-b border-gray-200 px-4 py-2.5 flex flex-wrap gap-2 items-center bg-gray-50/70">
          <span className="text-xs font-sans text-gray-600">Selected: <strong className="text-forest">{selectedVisibleNames.length}</strong></span>
          <select value={bulkTee} onChange={e => setBulkTee(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs font-sans">
            <option value="">Bulk Set Tee</option>
            {TEE_OPTIONS.map(tee => <option key={tee} value={tee}>{tee}</option>)}
          </select>
          <button onClick={applyBulkTee} disabled={!bulkTee || selectedVisibleNames.length === 0} className="px-2.5 py-1 text-xs rounded border border-gray-300 disabled:opacity-40">Apply Tee</button>
          <input value={bulkCredit} onChange={e => setBulkCredit(e.target.value)} type="number" step="0.01" placeholder="Bulk credit $" className="w-28 border border-gray-300 rounded px-2 py-1 text-xs font-mono" />
          <button onClick={() => applyBulkCredit(1)} disabled={!bulkCredit || selectedVisibleNames.length === 0} className="px-2.5 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-40">Bulk Add Credit</button>
          <button onClick={() => applyBulkCredit(-1)} disabled={!bulkCredit || selectedVisibleNames.length === 0} className="px-2.5 py-1 text-xs rounded bg-amber-600 text-white disabled:opacity-40">Bulk Subtract Credit</button>
          <button onClick={() => setSelectedRows(new Set())} disabled={selectedCount === 0} className="px-2.5 py-1 text-xs rounded border border-gray-300 disabled:opacity-40">Clear Selection</button>
        </div>

        <div className="max-h-[560px] overflow-auto" onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center w-12">
                  <input type="checkbox" checked={allVisibleSelected && hasVisibleRows} onChange={toggleSelectVisible} />
                </th>
                <th onClick={() => updateSort('name')} className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-left cursor-pointer">Player</th>
                <th onClick={() => updateSort('ptm')} className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center cursor-pointer">PTM</th>
                <th onClick={() => updateSort('creditOnBooks')} className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-right cursor-pointer">Credit on Books</th>
                <th className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center">Adjust Credit</th>
                <th onClick={() => updateSort('tee')} className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center cursor-pointer">Tee</th>
                <th className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center">Phone</th>
                <th className="table-header sticky top-0 z-20 bg-gray-50 text-gray-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shouldVirtualize && topSpacerHeight > 0 && (
                <tr>
                  <td colSpan={8} style={{ height: `${topSpacerHeight}px`, padding: 0, border: 0 }} />
                </tr>
              )}
              {visibleRows.map((row, idx) => {
                const isEditing = !!editingRows[row.originalName]
                const draft = rowDrafts[row.originalName] ?? { name: row.name, flight: row.flight ?? '', tee: row.tee ?? '', ptm: row.ptm ?? '', cell: row.cell ?? '' }
                const setDraft = (patch) => setRowDrafts(prev => ({ ...prev, [row.originalName]: { ...draft, ...patch } }))
                return (
                  <tr
                    key={row.originalName}
                    className={`border-b border-gray-100 last:border-0 transition-colors ${
                      (startIndex + idx) % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    } ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    style={shouldVirtualize ? { height: `${rowHeight}px` } : undefined}
                  >
                    <td className="px-3 py-2.5 text-center sticky left-0 bg-inherit">
                      <input type="checkbox" checked={selectedRows.has(row.originalName)} onChange={() => toggleSelect(row.originalName)} />
                    </td>
                    <td className="px-4 py-2.5 font-sans text-sm text-darktext whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={draft.name ?? ''}
                          onChange={e => setDraft({ name: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-forest w-44"
                          placeholder="Player name"
                        />
                      ) : (
                        formatName(row.name)
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={draft.ptm}
                          onChange={e => setDraft({ ptm: e.target.value })}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-forest"
                        />
                      ) : (
                        <span className="stat-number text-xs text-gray-600">
                          {roundPtm(row.ptm) ?? '—'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600">
                      {fmtCurrency(row.creditOnBooks)}
                    </td>

                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={creditAdjustments[row.originalName] ?? ''}
                          onChange={e => setCreditAdjustments(prev => ({ ...prev, [row.originalName]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && applyRowCredit(row.originalName)}
                          placeholder="+ / - $"
                          className="w-24 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                        />
                        <button
                          onClick={() => applyRowCredit(row.originalName)}
                          disabled={!creditAdjustments[row.originalName]}
                          title="Apply adjustment"
                          className={`w-7 h-7 flex items-center justify-center rounded text-sm font-bold disabled:opacity-30 transition-colors ${creditAppliedFlash[row.originalName] ? 'bg-green-600 text-white' : 'bg-forest text-white hover:bg-forest/80'}`}
                        >
                          ✓
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <select
                          value={draft.tee}
                          onChange={e => setDraft({ tee: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-forest"
                        >
                          <option value="">—</option>
                          {TEE_OPTIONS.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      ) : (
                        <TeeTag tee={row.tee} />
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <input
                          type="tel"
                          value={draft.cell ?? ''}
                          onChange={e => setDraft({ cell: e.target.value })}
                          className="w-32 border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-forest"
                          placeholder="555-123-4567"
                        />
                      ) : (
                        <span className="text-xs font-mono text-gray-500">{row.cell || '—'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => saveEditingRow(row.originalName)} className="px-2.5 py-1 text-xs rounded bg-forest text-white hover:bg-forest/80 font-sans font-semibold transition-colors">Save</button>
                          <button onClick={() => cancelEditingRow(row.originalName)} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEditingRow(row)}
                            className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-500 hover:text-forest hover:border-forest font-sans transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (await openConfirm(`Remove ${formatName(row.name)} from the roster? They will be marked inactive and hidden.`))
                                removeMember(row.originalName)
                            }}
                            className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 font-sans transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {shouldVirtualize && bottomSpacerHeight > 0 && (
                <tr>
                  <td colSpan={8} style={{ height: `${bottomSpacerHeight}px`, padding: 0, border: 0 }} />
                </tr>
              )}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400 font-sans text-sm">
                    No players match your filters.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-forest/5 border-t border-forest/20">
                <td colSpan={3} className="px-4 py-2 text-xs font-sans text-forest font-semibold uppercase tracking-widest">Visible Credit Total</td>
                <td className="px-4 py-2 text-right font-mono text-xs text-forest font-semibold">{fmtCurrency(totalCreditOnBooks)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

