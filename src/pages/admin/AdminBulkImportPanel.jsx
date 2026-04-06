import { getBulkImportTemplateDownload } from '../../services/admin/import'

function Stat({ label, value }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-2 py-2">
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-darktext">{value}</p>
    </div>
  )
}

export function AdminBulkImportPanel({
  importType,
  setImportType,
  importMode,
  importDefinitions,
  importPlan,
  importError,
  importStatus,
  planning,
  applying,
  fileName,
  onFileSelected,
  onApply,
  currentUser,
}) {
  const template = getBulkImportTemplateDownload(importType)
  const definition = importDefinitions[importType]

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-serif text-darktext">Bulk Import</h3>
        <p className="text-sm font-sans text-gray-600 mt-1">
          Admin-only dry run importer for historical CGA data. Current user: <span className="font-semibold">{currentUser || 'Admin'}</span>.
        </p>

        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <label className="text-sm font-sans">
            <span className="text-xs uppercase tracking-widest text-gray-500">Import Type</span>
            <select
              value={importType}
              onChange={e => setImportType(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {Object.entries(importDefinitions).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-sans">
            <span className="text-xs uppercase tracking-widest text-gray-500">Mode</span>
            <input
              value={importMode}
              readOnly
              className="mt-1 w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-700"
            />
          </label>
        </div>

        <div className="mt-4 p-3 rounded-md border border-gray-200 bg-gray-50">
          <p className="text-xs font-semibold uppercase tracking-widest text-forest">Template &amp; Rules</p>
          <p className="text-sm font-sans text-gray-700 mt-1">{definition.description}</p>
          <p className="text-xs font-sans text-gray-500 mt-2">
            Required columns: {definition.requiredColumns.join(', ')}
            {definition.optionalColumns.length > 0 ? ` · Optional: ${definition.optionalColumns.join(', ')}` : ''}
          </p>
          <ul className="mt-2 list-disc list-inside text-xs font-sans text-gray-600 space-y-1">
            {definition.usageNotes.map(note => <li key={note}>{note}</li>)}
          </ul>
          {template && (
            <a
              className="inline-flex mt-3 px-3 py-1.5 text-xs rounded border border-forest/30 text-forest hover:bg-forest/10"
              href={template.href}
              download={template.fileName}
            >
              Download {definition.label} CSV Template
            </a>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <label className="inline-flex items-center px-3 py-2 text-xs font-sans rounded-md bg-forest text-white cursor-pointer hover:bg-forest/90">
            {planning ? 'Reading file…' : 'Upload .xlsx or .csv'}
            <input type="file" className="hidden" accept=".xlsx,.csv" onChange={onFileSelected} disabled={planning || applying} />
          </label>
          <span className="text-xs font-sans text-gray-500">{fileName || 'No file selected'}</span>
        </div>
      </section>

      {importError && (
        <section className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm font-sans text-red-700">
          {importError}
        </section>
      )}

      {importPlan && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-widest text-forest">Dry Run Preview</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-sans">
            <Stat label="Rows" value={importPlan.summary.rowsDetected} />
            <Stat label="Valid" value={importPlan.summary.validRows} />
            <Stat label="Invalid" value={importPlan.summary.invalidRows} />
            <Stat label="New Adds" value={importPlan.summary.toAdd} />
            <Stat label="Duplicates" value={importPlan.summary.duplicates} />
            <Stat label="Conflicts" value={importPlan.summary.conflicts} />
            <Stat label="Updates" value={importPlan.summary.updates} />
            <Stat label="Blocking Errors" value={importPlan.summary.blockingErrors} />
          </div>

          {importPlan.issues.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-widest">Validation Issues</p>
              <ul className="mt-2 space-y-1 text-xs text-red-700 font-sans max-h-48 overflow-auto">
                {importPlan.issues.map((issue, idx) => (
                  <li key={`${issue.rowNumber}-${idx}`}>
                    Row {issue.rowNumber}: {issue.issue}{issue.suggestion ? ` — ${issue.suggestion}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importPlan.duplicates.length > 0 && (
            <p className="text-xs font-sans text-amber-700">{importPlan.duplicates.length} duplicate row(s) will be skipped automatically in add-only mode.</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onApply}
              disabled={applying || planning || importPlan.issues.length > 0 || importPlan.toAdd.length === 0}
              className="px-4 py-2 text-xs font-sans font-semibold rounded-md bg-forest text-white disabled:opacity-50"
            >
              {applying ? 'Applying…' : `Apply Import (${importPlan.toAdd.length} add)`}
            </button>
            {importStatus === 'ok' && <span className="text-xs font-sans text-green-700">Import completed and logged.</span>}
            {importStatus === 'err' && <span className="text-xs font-sans text-red-700">Import failed. See error details above.</span>}
          </div>
        </section>
      )}
    </div>
  )
}
