import { Link } from 'react-router-dom'
import CountdownTimer from '../../components/ui/CountdownTimer'
import { formatDateFull, formatDateLong } from '../../utils/formatDate'

export function DashboardPanel({
  nextTournament, selectedTournament, workflow,
  lastPublishedTournament, hasUnsavedDrafts, unsavedDrafts, onRepublish, publishSaving,
  onGoToScores, onGoToPayments, onGoToPairings, onMarkMemoSent, onUndoMemoSent, onFinalizeField, onUnfinalizeField, onExportBirdiePool, onGeneratePayout,
  tournamentCompletionOverrides, onMarkComplete, onUnmarkComplete,
}) {
  const fieldFinalized = workflow.counts.fieldFinalized
  const memoSent = workflow.lifecycleSteps.find(s => s.key === 'memo')?.status === 'complete'
  const lifecycleActions = {
    memo: memoSent
      ? { label: 'Mark Sent', action: onMarkMemoSent, secondary: { label: 'Undo Sent', action: onUndoMemoSent } }
      : { label: 'Mark Sent', action: onMarkMemoSent },
    field: fieldFinalized
      ? { label: 'Undo Finalize', action: onUnfinalizeField }
      : { label: 'Finalize Field', action: onFinalizeField, secondary: { label: 'Review Entries', action: onGoToPayments } },
    pairingsLifecycle: { label: workflow.counts.pairingsState === 'published' ? 'Edit Pairings' : 'Generate Pairings', action: onGoToPairings },
    birdie: { label: 'Export', action: onExportBirdiePool },
    scoresLifecycle: { label: workflow.counts.resultsPublished ? 'View Results' : 'Enter Scores', action: onGoToScores },
    payout: { label: 'Generate', action: onGeneratePayout },
  }

  const selectedId = selectedTournament?.id
  // A tournament is statically completed if schedule.json already says so
  const isStaticCompleted = selectedTournament?.status === 'completed'
  // A tournament is dynamically completed if the admin marked it at runtime
  const isDynamicCompleted = !!(tournamentCompletionOverrides ?? {})[selectedId]

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-2">Overview</p>
        <h2 className="text-darktext font-heading text-2xl font-semibold mb-1">{selectedTournament?.name ?? 'No tournament selected'}</h2>
        <p className="text-gray-500 font-sans text-sm mb-4">{selectedTournament?.date ? formatDateFull(selectedTournament.date) : 'No date available'}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Field" value={`${workflow.counts.enteredCount} / ${workflow.counts.fieldCap}`} detail={`${Math.max(workflow.counts.fieldCap - workflow.counts.enteredCount, 0)} spots remaining`} />
          <MetricCard label="Paid" value={`${workflow.counts.paidCount}`} detail={workflow.counts.enteredCount > 0 ? `${workflow.counts.enteredCount - workflow.counts.paidCount} unpaid` : 'No entries yet'} />
          <MetricCard label="Pairings" value={workflow.counts.pairingsState === 'published' ? 'Published' : workflow.counts.pairingsState === 'draft' ? 'Draft' : 'Not Started'} detail={`${workflow.counts.pairedCount}/${workflow.counts.enteredCount || 0} grouped`} />
          <MetricCard label="Scores" value={`${workflow.counts.scoredCount}/${workflow.counts.enteredCount || 0}`} detail={workflow.counts.scoredCount === 0 ? 'Not started' : workflow.counts.scoredCount >= workflow.counts.enteredCount && workflow.counts.enteredCount > 0 ? 'Complete' : 'In progress'} />
          <MetricCard label="Results / Payout" value={workflow.counts.resultsPublished ? 'Published' : 'Pending'} detail={workflow.lifecycleSteps.find(step => step.key === 'payout')?.label ?? 'Payout status unavailable'} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onGoToPayments} className="px-3 py-2 text-xs font-sans font-semibold rounded-md border border-forest/30 text-forest hover:bg-forest/5">Entries</button>
          <button onClick={onGoToPairings} className="px-3 py-2 text-xs font-sans font-semibold rounded-md border border-forest/30 text-forest hover:bg-forest/5">Pairings</button>
          <button onClick={onGoToScores} className="px-3 py-2 text-xs font-sans font-semibold rounded-md border border-forest/30 text-forest hover:bg-forest/5">Scores / Results</button>
        </div>

        {selectedTournament && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[11px] font-heading font-semibold uppercase tracking-widest text-gray-500 mb-2">Site Completion Status</p>
            {isStaticCompleted ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 border border-gray-200">
                <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                <span className="text-xs font-sans font-semibold text-gray-600">Completed (built into schedule)</span>
              </div>
            ) : isDynamicCompleted ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-50 border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-xs font-sans font-semibold text-green-700">Marked Complete — site updated</span>
                </div>
                <button
                  onClick={onUnmarkComplete}
                  className="px-3 py-1.5 text-xs font-sans font-semibold rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  Undo Completion
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-gray-200">
                  <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0 animate-pulse" />
                  <span className="text-xs font-sans font-semibold text-gray-600">Upcoming — not yet complete</span>
                </div>
                <button
                  onClick={onMarkComplete}
                  className="px-3 py-1.5 text-xs font-sans font-semibold rounded-md bg-forest text-white hover:bg-forest/90 transition-colors"
                >
                  Mark Tournament Complete
                </button>
              </div>
            )}
            <p className="mt-2 text-[11px] font-sans text-gray-400">
              Marking complete updates the home page next-tournament banner and the full schedule instantly across the site.
            </p>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-2">Next Tournament</p>
        {nextTournament ? (
          <>
            <h2 className="text-darktext font-heading text-2xl font-semibold mb-1">{nextTournament.name}</h2>
            <p className="text-gray-500 font-sans text-sm mb-4">{formatDateFull(nextTournament.date)}</p>
            <CountdownTimer targetDate={nextTournament.date} />
          </>
        ) : (
          <p className="text-gray-500 font-sans text-sm">No upcoming tournaments on schedule.</p>
        )}
      </section>

      {hasUnsavedDrafts && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-amber-800 font-sans font-semibold text-sm mb-1">Unsaved Drafts Detected</h3>
          <p className="text-amber-700 font-sans text-xs">
            Local-only changes exist in: {unsavedDrafts.map(item => item.label).join(', ')}.
          </p>
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <TournamentWorkflowTracker workflow={{ steps: workflow.lifecycleSteps }} actions={lifecycleActions} />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-2">Last Published Tournament</p>
        {lastPublishedTournament ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-darktext font-heading text-xl font-semibold">{lastPublishedTournament.name}</h3>
              <p className="text-gray-500 font-sans text-sm">{formatDateLong(lastPublishedTournament.date)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/tournaments"
                state={{ expand: lastPublishedTournament.id }}
                className="px-3 py-2 text-xs font-sans font-semibold rounded-md bg-white text-gray-600 border border-gray-300 hover:text-forest hover:border-forest"
              >
                View Results
              </Link>
              <button
                onClick={onRepublish}
                disabled={publishSaving}
                className="px-3 py-2 text-xs font-sans font-semibold rounded-md bg-forest text-white disabled:opacity-60"
              >
                {publishSaving ? 'Publishing…' : 'Re-publish'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 font-sans text-sm">No published tournament results found.</p>
        )}
      </section>
    </div>
  )
}

export function MetricCard({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-[11px] font-heading font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 stat-number text-2xl text-forest leading-none">{value}</p>
      <p className="mt-1 text-xs font-sans text-gray-500">{detail}</p>
    </div>
  )
}

export function TournamentWorkflowTracker({ workflow, actions = {} }) {
  const statusStyles = {
    complete: {
      dot: 'bg-green-500',
      card: 'bg-green-50 border-green-200',
      title: 'text-green-800',
      text: 'text-green-700',
      badge: 'Complete',
      badgeStyle: 'bg-green-100 text-green-700',
    },
    partial: {
      dot: 'bg-amber-500',
      card: 'bg-amber-50 border-amber-200',
      title: 'text-amber-800',
      text: 'text-amber-700',
      badge: 'In progress',
      badgeStyle: 'bg-amber-100 text-amber-700',
    },
    not_started: {
      dot: 'bg-gray-300',
      card: 'bg-gray-50 border-gray-200',
      title: 'text-gray-700',
      text: 'text-gray-500',
      badge: 'Not started',
      badgeStyle: 'bg-gray-200 text-gray-600',
    },
  }

  return (
    <div>
      <p className="text-xs font-heading font-semibold uppercase tracking-widest text-forest mb-2">Tournament Workflow</p>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {workflow.steps.map((step, idx) => {
          const style = statusStyles[step.status]
          const actionMeta = actions[step.key]
          return (
            <li key={step.key} className={`border rounded-lg p-3 ${style.card}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
                  <span className="text-[11px] font-sans font-semibold text-gray-500">{idx + 1}</span>
                </div>
                <span className={`text-[10px] font-sans font-semibold uppercase px-1.5 py-0.5 rounded ${style.badgeStyle}`}>{style.badge}</span>
              </div>
              <p className={`text-xs font-sans font-semibold leading-snug ${style.title}`}>{step.title}</p>
              <p className={`text-xs font-sans mt-1 ${style.text}`}>{step.label}</p>
              {actionMeta?.action && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    onClick={actionMeta.action}
                    className="px-2.5 py-1 text-[11px] font-sans font-semibold rounded border border-forest/30 text-forest hover:bg-forest/5"
                  >
                    {actionMeta.label}
                  </button>
                  {actionMeta.secondary?.action && (
                    <button
                      onClick={actionMeta.secondary.action}
                      className="px-2.5 py-1 text-[11px] font-sans font-semibold rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      {actionMeta.secondary.label}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
