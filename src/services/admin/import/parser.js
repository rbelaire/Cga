import * as XLSX from 'xlsx'

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase()
}

function remapHeaders(row = {}, headerAliases = {}) {
  const mapped = {}
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeader(key)
    const canonical = headerAliases[normalized] ?? key
    mapped[canonical] = value
  }
  return mapped
}

function parseWorkbookBuffer(buffer, headerAliases = {}) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  return workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    const rows = rawRows.map((row, idx) => ({
      rowNumber: idx + 2,
      row: remapHeaders(row, headerAliases),
    }))
    return { sheetName, rows }
  })
}

function parseCsvText(text, headerAliases = {}) {
  const wb = XLSX.read(text, { type: 'string', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return [{
    sheetName: 'CSV',
    rows: rawRows.map((row, idx) => ({
      rowNumber: idx + 2,
      row: remapHeaders(row, headerAliases),
    })),
  }]
}

export async function parseBulkImportFile(file, { headerAliases = {} } = {}) {
  const name = String(file?.name ?? '').toLowerCase()
  if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) {
    throw new Error('Unsupported file format. Please upload a .xlsx or .csv file.')
  }

  if (name.endsWith('.csv')) {
    const text = await file.text()
    return parseCsvText(text, headerAliases)
  }

  const buffer = await file.arrayBuffer()
  return parseWorkbookBuffer(buffer, headerAliases)
}

export function collectRowsForImportType(parsedSheets = [], importType) {
  const targetSheet = parsedSheets.find(sheet => sheet.sheetName.toLowerCase() === importType)
  if (targetSheet) return targetSheet.rows

  if (parsedSheets.length === 1) return parsedSheets[0].rows
  return []
}
