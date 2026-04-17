const CREDIT_COLUMNS = ['member', 'amount', 'date', 'note', 'reference']
const TOURNAMENT_COLUMNS = ['tournamentId', 'title', 'date', 'course', 'format', 'entryFee']
const RESULT_COLUMNS = ['flight', 'member', 'score', 'notes']

function toCsv(columns, rows) {
  const escape = (value) => {
    const text = String(value ?? '')
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replaceAll('"', '""')}"`
    }
    return text
  }
  return [columns.join(','), ...rows.map(row => columns.map(col => escape(row[col])).join(','))].join('\n')
}

function toDataUrl(csvText) {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csvText)}`
}

export const BULK_IMPORT_DEFINITIONS = {
  credits: {
    label: 'Credits',
    requiredColumns: ['member', 'amount', 'date'],
    optionalColumns: ['note', 'reference'],
    description: 'Imports additive credit transactions and updates member balances.',
    usageNotes: [
      'Amounts can be positive or negative and are applied as adjustments.',
      'Duplicate detection uses member + date + amount + note + reference.',
      'Rows referencing unknown members are blocked until fixed.',
    ],
    sampleRows: [
      { member: 'Jane Doe', amount: 25, date: '2024-05-17', note: 'Opening balance import', reference: 'hist-001' },
      { member: 'John Smith', amount: -10, date: '2024-05-20', note: 'Tournament snack charge', reference: 'txn-2024-05-20-1' },
    ],
    columns: CREDIT_COLUMNS,
  },
  tournaments: {
    label: 'Tournaments',
    requiredColumns: ['tournamentId', 'title', 'date'],
    optionalColumns: ['course', 'format', 'entryFee'],
    description: 'Imports historical tournament metadata into results records (empty leaderboard).',
    usageNotes: [
      'Use a stable tournamentId (e.g. 2024-spring-classic).',
      'If the tournament already exists in results, it is skipped in add-only mode.',
      'Date should be YYYY-MM-DD for consistency.',
    ],
    sampleRows: [
      { tournamentId: '2024-spring-classic', title: 'Spring Classic', date: '2024-03-15', course: 'Shadow Hills', format: 'Stableford', entryFee: 95 },
    ],
    columns: TOURNAMENT_COLUMNS,
  },
  results: {
    label: 'Results',
    requiredColumns: ['flight', 'member', 'score'],
    optionalColumns: ['notes'],
    description: 'Imports player results into tournament leaderboards. Select the target tournament from the dropdown — no tournamentId column needed in the file.',
    usageNotes: [
      'Select the target tournament from the dropdown before uploading.',
      'Duplicate detection uses tournament + normalized flight + member.',
      'Rows are blocked if member is unknown or score is not numeric.',
      'Position/rank is computed automatically from scores.',
    ],
    sampleRows: [
      { flight: 'Championship', member: 'Jane Doe', score: 38, notes: 'Imported historical scorecard' },
      { flight: '1st Flight', member: 'John Smith', score: 32, notes: '' },
    ],
    columns: RESULT_COLUMNS,
  },
}

export function getBulkImportTemplateCsv(importType) {
  const definition = BULK_IMPORT_DEFINITIONS[importType]
  if (!definition) return null
  return toCsv(definition.columns, definition.sampleRows)
}

export function getBulkImportTemplateDownload(importType) {
  const definition = BULK_IMPORT_DEFINITIONS[importType]
  if (!definition) return null
  const csvText = getBulkImportTemplateCsv(importType)
  return {
    fileName: `cga-${importType}-template.csv`,
    href: toDataUrl(csvText),
  }
}
